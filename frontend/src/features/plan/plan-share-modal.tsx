'use client'

import { useEffect, useRef, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { FormAlert } from '@/components/form-alert'
import { Modal } from '@/components/modal'
import { Skeleton } from '@/components/skeleton'
import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { fetchPlanShareLink, issuePlanShareLink, revokePlanShareLink } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import { shareExpiryLabel, shareUrlOf } from '@/lib/plan/share-link'
import type { PlanShareLink } from '@/types/plan'

/** 복사됨 표시를 되돌리기까지 */
const COPIED_RESET_MS = 2000

/**
 * 일정 공유 링크 발급·폐기 (#628).
 *
 * **`PlanManageMenu` 안에서만 열린다.** 진입점이 그 메뉴인 이유는 거기가 이미
 * `plan.status.code` 로 항목을 가르는 자리이기 때문이다 — 초안에는 항목 자체가 없다.
 * 그래서 이 컴포넌트는 `PLAN_022`(공유 불가) 갈래를 정상 흐름으로 다루지 않는다.
 *
 * **`GET` 의 404 는 오류가 아니다.** "한 번도 발급하지 않았거나 이미 폐기·만료됐다" 는
 * 뜻이고 어느 쪽이든 할 일은 같다 — 새로 만드는 것이다. `null` 로 접어 빈 상태를 그린다.
 * 이 갈래를 오류로 그리면 **처음 공유하는 사람이 전부 오류 화면을 본다.**
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

  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  /*
    **`origin` 을 state 로 든다.** 서버 렌더에는 `window` 가 없어 첫 렌더에서 읽으면
    하이드레이션이 갈린다. 모달이라 열릴 때만 필요하고, 그때는 이미 브라우저다.
  */
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  const {
    data: link,
    isPending,
    isError,
  } = useQuery({
    queryKey: planKeys.shareLink(planId),
    queryFn: () =>
      fetchPlanShareLink(planId).catch((error: unknown) => {
        // 404 는 "아직 공유 중이 아니다" 다 — 오류 갈래로 보내지 않는다
        if (error instanceof ApiError && error.kind === 'not-found') return null
        throw error
      }),
    ...PLAN_QUERY_OPTIONS,
    retry: 1,
    enabled: open,
  })

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
        onClose={onClose}
        title={messages.plan.shareTitle}
        description={messages.plan.shareDescription}
        size="md"
        initialFocusRef={closeRef}
        footer={
          <Button ref={closeRef} variant="secondary" onClick={onClose}>
            {messages.common.close}
          </Button>
        }
      >
        <PlanShareContent
          state={isPending ? 'loading' : isError ? 'error' : link ? 'shared' : 'idle'}
          url={url}
          expiry={expiry}
          issuing={issue.isPending}
          copied={copied}
          copyFailed={copyFailed}
          onIssue={() => issue.mutate()}
          onCopy={() => void handleCopy()}
          onRevoke={() => setConfirming(true)}
        />

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

/** 모달 본문의 네 갈래. 데이터는 `PlanShareModal` 이 들고, 이쪽은 그리기만 한다 */
export type PlanShareState = 'loading' | 'error' | 'idle' | 'shared'

export type PlanShareContentProps = {
  state: PlanShareState
  /** 공유 중인데 `null` 이면 아직 `origin` 을 못 읽은 첫 렌더다 — 복사를 잠근다 */
  url: string | null
  expiry: string | null
  issuing: boolean
  copied: boolean
  copyFailed: boolean
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
  url,
  expiry,
  issuing,
  copied,
  copyFailed,
  onIssue,
  onCopy,
  onRevoke,
}: PlanShareContentProps) {
  if (state === 'loading') return <Skeleton className="h-24 w-full" />
  if (state === 'error') return <FormAlert message={messages.plan.shareLoadError} />

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
