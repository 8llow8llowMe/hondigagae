'use client'

import { useEffect, useRef, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { ErrorState } from '@/components/error-state'
import { FormAlert } from '@/components/form-alert'
import { Modal } from '@/components/modal'
import { Skeleton } from '@/components/skeleton'
import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { fetchPlanShareLink, issuePlanShareLink, revokePlanShareLink } from '@/lib/api/plan'
import type { FailureAnnounce } from '@/lib/form/submit-failure-focus'
import { messages } from '@/lib/messages'
import {
  type PlanShareState,
  shareContentState,
  shareExpiryLabel,
  shareFailureAnnounce,
  shareLoadFailure,
  type ShareRetryPhase,
  shareUrlOf,
  shouldRetryShareLinkQuery,
} from '@/lib/plan/share-link'
import type { PlanShareLink } from '@/types/plan'

/** 복사됨 표시를 되돌리기까지 */
const COPIED_RESET_MS = 2000

/**
 * 재시도 결과가 서면 포커스를 받을 자리 — **본문 안 문서 순서로 첫 번째**다 (#1159).
 * 일시 장애면 그 상자(버튼보다 앞), 서버 문구 알림이면 그 알림, 공유 중이 아니면 `링크 만들기`,
 * 공유 중이면 주소 칸(라벨과 주소를 함께 읽는다 — 무엇이 불러와졌는지가 곧 결과다).
 */
const RETRY_RESULT_FOCUS_SELECTOR = '[data-share-temporary-error], [data-form-alert], button, input'

/**
 * 일정 공유 링크 발급·폐기 (#628).
 *
 * **공유할 수 있는 일정에서만 열린다.** 진입점은 둘이고 둘 다 지금 상태로 걸러져 있다 —
 * `PlanManageMenu` 의 항목(초안에는 잠긴 항목만 선다, #1154)과 확정 직후 결과 안내 아래
 * `공유 링크`(`plan-status-action.tsx`, #1174 — 확정 성공 뒤, 지금 상태가 확정일 때만 선다).
 * 그래서 이 컴포넌트는 `PLAN_022`(공유 불가) 갈래를 정상 흐름으로 다루지 않는다.
 *
 * **`GET` 의 `null` 은 오류가 아니다.** "한 번도 발급하지 않았거나 이미 폐기·만료됐다" 는
 * 뜻이고 어느 쪽이든 할 일은 같다 — 새로 만드는 것이다. 서버가 200 + `dataBody: null` 로
 * 답하고(#979) 빈 상태를 그린다. 이 갈래를 오류로 그리면 **처음 공유하는 사람이 전부 오류
 * 화면을 본다.** 반대로 404(`PLAN_001`, 일정 없음)는 이제 오류 갈래다.
 *
 * **폐기에 확인 대화상자를 붙인다.** 되돌릴 수 없다 — 다시 발급하면 **다른 토큰**이
 * 나오고 이미 보낸 링크는 죽는다. 삭제와 같은 무게다.
 *
 * **주소는 `window.location.origin` 으로 만든다.** `NEXT_PUBLIC_*` 로 기준 주소를 하나
 * 더 두면 프리뷰·dev·프로덕션에서 어긋날 자리가 하나 더 생긴다 (`shareUrlOf`).
 */
export function PlanShareModal({
  planId,
  open,
  onClose,
}: {
  planId: string
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [retryPhase, setRetryPhase] = useState<ShareRetryPhase>('idle')

  /*
    **`origin` 을 state 로 든다.** 서버 렌더에는 `window` 가 없어 첫 렌더에서 읽으면
    하이드레이션이 갈린다. 모달이라 열릴 때만 필요하고, 그때는 이미 브라우저다.
  */
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  const {
    data: link,
    error,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: planKeys.shareLink(planId),
    // 공유 중이 아니면 `null` 이다 (#979) — 404 를 잡아 접지 않는다. 일정이 없는 PLAN_001 은 오류다
    queryFn: () => fetchPlanShareLink(planId),
    ...PLAN_QUERY_OPTIONS,
    // §7 "retry 1" 을 오류 종류를 보존한 채 — 5xx·무응답만 한 번 (`shouldRetryShareLinkQuery`)
    retry: shouldRetryShareLinkQuery,
    enabled: open,
  })

  // 재시도 중이면 실패보다 골격이 먼저다 — 우선순위와 이유는 `shareContentState`
  const failure = isError ? shareLoadFailure(error) : null
  const contentState = shareContentState({
    isPending,
    isFetching,
    retryPhase,
    failure,
    hasLink: link !== null && link !== undefined,
  })

  function handleRetry() {
    /*
      **누르기 전에 포커스를 본문 상자로 옮긴다.** 재시도 버튼이 골격으로 바뀌며 사라지면
      브라우저는 포커스를 `BODY` 로 떨어뜨린다 — 모달 밖이다 (`form-guide.md` §8, #1078).
    */
    contentRef.current?.focus()
    setRetryPhase('running')
    void refetch().then(() =>
      // 그 사이 모달을 닫았으면(`idle`) 늦게 온 결과가 상태를 되살리지 않는다
      setRetryPhase((phase) => (phase === 'running' ? 'settled' : phase)),
    )
  }

  useEffect(() => {
    /*
      **포커스를 준 결과가 바뀌기 시작하면 `idle` 로 돌아간다.** 그 뒤의 실패(`링크 만들기` 뒤
      무효화 등)에는 포커스가 오지 않으므로 `role="alert"` 로 읽혀야 한다 (`shareFailureAnnounce`).
    */
    if (retryPhase === 'focused') {
      if (isFetching) setRetryPhase('idle')
      return
    }

    // 재시도 결과가 그려진 뒤에 포커스를 옮긴다 — 요청이 끝난 것과 결과가 그려진 것은 따로 온다
    if (retryPhase !== 'settled' || isFetching) return

    const container = contentRef.current
    const target = container?.querySelector<HTMLElement>(RETRY_RESULT_FOCUS_SELECTOR)
    ;(target ?? container)?.focus()
    setRetryPhase('focused')
  }, [retryPhase, isFetching])

  function handleClose() {
    setRetryPhase('idle')
    onClose()
  }

  function afterChange(next: PlanShareLink | null) {
    queryClient.setQueryData(planKeys.shareLink(planId), next)
    void queryClient.invalidateQueries({ queryKey: planKeys.shareLink(planId) })
    setActionError(null)
    setCopied(false)
    setCopyFailed(false)
  }

  const issue = useMutation({
    mutationFn: () => issuePlanShareLink(planId),
    onSuccess: afterChange,
    onError: () => setActionError(messages.plan.shareIssueError),
  })

  const revoke = useMutation({
    mutationFn: () => revokePlanShareLink(planId),
    onSuccess: () => {
      afterChange(null)
      setConfirming(false)
    },
    onError: () => setActionError(messages.plan.shareRevokeError),
  })

  const url = link === null || link === undefined ? null : shareUrlOf(link.token, origin)
  const expiry =
    link === null || link === undefined ? null : shareExpiryLabel(link.expiresAt, new Date())

  async function handleCopy() {
    if (url === null) return

    /*
      **조용히 실패하지 않는다.** 비 HTTPS·구형 브라우저에는 `navigator.clipboard` 가
      아예 없다. 그때는 주소가 화면에 읽기 전용으로 떠 있으므로 "직접 복사" 를 안내하는
      것이 실제로 가능한 다음 행동이다.
    */
    try {
      await navigator.clipboard.writeText(url)
      setCopyFailed(false)
      setCopied(true)
    } catch {
      setCopied(false)
      setCopyFailed(true)
    }
  }

  // 복사됨 표시를 되돌린다. 모달이 닫혀도 타이머가 남지 않게 정리한다
  useEffect(() => {
    if (!copied) return

    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={messages.plan.shareTitle}
        description={messages.plan.shareDescription}
        size="md"
        initialFocusRef={closeRef}
        footer={
          <Button ref={closeRef} variant="secondary" onClick={handleClose}>
            {messages.common.close}
          </Button>
        }
      >
        {/*
          재시도 중 포커스를 맡는 상자다 — `tabIndex={-1}` 이라 탭 순서에는 들지 않는다.
          포커스 테두리는 지우지 않는다(`FormAlert` 와 같은 토큰 링).
        */}
        <div
          ref={contentRef}
          tabIndex={-1}
          aria-busy={(contentState === 'loading' && !isPending) || undefined}
          className="focus-visible:ring-brand-500 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <PlanShareContent
            state={contentState}
            errorMessage={failure?.kind === 'alert' ? failure.message : null}
            announce={shareFailureAnnounce(retryPhase)}
            url={url}
            expiry={expiry}
            issuing={issue.isPending}
            copied={copied}
            copyFailed={copyFailed}
            onRetry={handleRetry}
            onIssue={() => issue.mutate()}
            onCopy={() => void handleCopy()}
            onRevoke={() => setConfirming(true)}
          />
        </div>

        <FormAlert message={actionError} />
      </Modal>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => revoke.mutate()}
        title={messages.plan.shareRevokeConfirmTitle}
        description={messages.plan.shareRevokeConfirmDescription}
        confirmLabel={messages.plan.shareRevokeAction}
        cancelLabel={messages.plan.editCancel}
        confirmLoading={revoke.isPending}
        destructive
      />
    </>
  )
}

// 본문 갈래 판정은 `shareContentState` 가 한다 — 데이터는 `PlanShareModal` 이 들고, 이쪽은 그리기만 한다
export type { PlanShareState }

export type PlanShareContentProps = {
  state: PlanShareState
  /** `error` 갈래의 서버 문구. 그 밖의 갈래에서는 `null` 이다 */
  errorMessage: string | null
  /** 실패 표시가 무엇으로 읽히는가 — 판정과 이유는 `shareFailureAnnounce` (#1102) */
  announce: FailureAnnounce
  /** 공유 중인데 `null` 이면 아직 `origin` 을 못 읽은 첫 렌더다 — 복사를 잠근다 */
  url: string | null
  expiry: string | null
  issuing: boolean
  copied: boolean
  copyFailed: boolean
  onRetry: () => void
  onIssue: () => void
  onCopy: () => void
  onRevoke: () => void
}

/**
 * 모달 본문 — **상태를 받기만 하는 순수 표현 컴포넌트다.**
 *
 * 갈라 둔 이유는 테스트다. `PlanShareModal` 은 `useQuery` 를 안에서 부르므로
 * `renderToStaticMarkup` 으로 네 갈래를 나란히 볼 수 없다 — 이 저장소의 렌더 테스트는
 * 문자열 assertion 이라 provider 를 세우는 대신 표현을 갈라낸다 (`PlanReviewPanel` 과
 * 같은 구조).
 */
export function PlanShareContent({
  state,
  errorMessage,
  announce,
  url,
  expiry,
  issuing,
  copied,
  copyFailed,
  onRetry,
  onIssue,
  onCopy,
  onRevoke,
}: PlanShareContentProps) {
  if (state === 'loading') return <Skeleton className="h-24 w-full" />
  if (state === 'unavailable') {
    return (
      /*
        **상자가 낭독과 포커스를 맡는다** — `FormFailure` 의 일시 장애와 같은 모양이다. 재시도 버튼이
        아니라 상자인 이유: 오프라인이면 `ErrorState` 가 버튼을 걷는다(#912).
        `headingLevel={3}` — 모달 제목(`h2`) 안의 내용이다.
      */
      <div
        role={announce === 'live' ? 'alert' : undefined}
        tabIndex={-1}
        data-share-temporary-error=""
        className="focus-visible:ring-brand-500 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ErrorState
          title={messages.plan.shareLoadErrorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
          headingLevel={3}
          flush
        />
      </div>
    )
  }

  // 404 `PLAN_001` 등 — 다시 불러도 결과가 같다. 재시도를 두지 않는다 (#979)
  if (state === 'error') return <FormAlert message={errorMessage} announce={announce} />

  if (state === 'idle') {
    return (
      <Button onClick={onIssue} loading={issuing}>
        {messages.plan.shareIssueAction}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        **`readOnly` 이고 `disabled` 가 아니다.** `disabled` 는 포커스가 잡히지 않아
        복사 버튼이 실패했을 때 수동 복사까지 막힌다.
      */}
      <input
        readOnly
        value={url ?? ''}
        aria-label={messages.plan.shareLinkFieldLabel}
        onFocus={(event) => event.currentTarget.select()}
        className="border-border text-body-2 text-fg-muted w-full rounded-md border px-3 py-2"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onCopy} disabled={url === null}>
          {copied ? messages.plan.shareCopiedLabel : messages.plan.shareCopyAction}
        </Button>
        <Button variant="ghost" onClick={onRevoke}>
          {messages.plan.shareRevokeAction}
        </Button>
      </div>

      {/* 버튼 라벨만 바꾸면 스크린리더가 말하지 않는다 */}
      <p aria-live="polite" className="sr-only">
        {copied ? messages.plan.shareCopiedLabel : ''}
      </p>

      {expiry !== null && <p className="text-caption text-fg-subtle font-medium">{expiry}</p>}

      {copyFailed && <FormAlert message={messages.plan.shareCopyError} />}
    </div>
  )
}
