'use client'

import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { ButtonLink } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceStack } from '@/components/surface'
import { AiPlanCanceled } from '@/features/ai-plan/ai-plan-canceled'
import { AiPlanCommitPanel } from '@/features/ai-plan/ai-plan-commit-panel'
import { AiPlanDraftPreview } from '@/features/ai-plan/ai-plan-draft-preview'
import { AiPlanFailed } from '@/features/ai-plan/ai-plan-failed'
import { AiPlanProgress } from '@/features/ai-plan/ai-plan-progress'
import { aiPlanCommitSchema } from '@/features/ai-plan/schemas'
import { useAiPlanJob } from '@/features/ai-plan/use-ai-plan-job'
import { useAiPlanResubmit } from '@/features/ai-plan/use-ai-plan-resubmit'
import { useDraftPlaces } from '@/features/ai-plan/use-draft-places'
import { usePetList } from '@/features/pet/use-pet-list'
import { SIGUNGU_LABEL } from '@/features/place/filter-labels'
import { planKeys } from '@/features/plan/queries'
import { formatBudget } from '@/lib/ai-plan/budget'
import { snapshotFromConditions } from '@/lib/ai-plan/conditions'
import { defaultPlanTitle } from '@/lib/ai-plan/draft-title'
import { draftToPlanPayload } from '@/lib/ai-plan/draft-to-plan'
import { isNarrowedRegionFailure } from '@/lib/ai-plan/failure-hint'
import { isJobCanceled, isJobFailed, jobStepProgress } from '@/lib/ai-plan/job'
import { petNamesLabel } from '@/lib/ai-plan/pet-names'
import { clearAiPlanRequest, readAiPlanRequest } from '@/lib/ai-plan/request-store'
import { ApiError } from '@/lib/api/error'
import { createPlan } from '@/lib/api/plan'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { formatPlanDateRange, totalDaysBetween } from '@/lib/plan/date'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { AiPlanDraft, AiPlanRequestSnapshot } from '@/types/ai-plan'
import type { PlanDetail } from '@/types/plan'

/** 담기가 `PLAN_004` 로 막혔는가 — delisting 된 장소가 초안에 있다 */
function isDelistedFailure(error: unknown): boolean {
  return error instanceof ApiError && error.resultCode === 'PLAN_004'
}

/**
 * 생성 대기 · 결과 — 명세 S0 · S4 · S6 · S7.
 *
 * 상태 여섯을 여기서 가른다:
 *  1. 조회 실패 404(`AIPLAN_002`) → `not-found` 성격, **재시도를 주지 않는다**
 *  2. 조회 실패 그 외 → `ErrorState` + 재시도
 *  3. `PENDING`/`RUNNING`(+ 상한) → 진행 표시 + 그만두기
 *  4. `FAILED` (**HTTP 200**) → `AiPlanFailed`
 *  5. `CANCELED` (#250) → `AiPlanCanceled` — **실패와 갈라 놓는다**
 *  6. `COMPLETED` → 미리보기 + 담기
 *
 * **여섯 갈래가 전부 `AiPlanJobShell` 을 거친다** (`DESIGN.md §0`, #473) — 머리(`h1`)와
 * 카드 하나. 완료만 `bare` 로 빠져 자기 카드들을 그린다. 껍데기를 씌우는 자리가 여기인
 * 이유는 **어느 갈래가 카드를 스스로 그리는지 상태를 아는 쪽만 알기 때문**이다 (#451).
 */
export function AiPlanJobView({ jobId, authed }: { jobId: string; authed: boolean }) {
  const { query, phase, polling, recheck, cancel, canceling, cancelFailed } = useAiPlanJob(jobId)

  /*
    **조건은 `sessionStorage` 에서 읽는다** (명세 S5 함정 1). 지연 초기화로 한 번만 읽어
    폴링 리렌더마다 파싱하지 않는다.

    **지연 초기화가 하이드레이션을 보장하지는 않는다** — client component 도 서버에서
    렌더되고 그때는 `sessionStorage` 가 없어 항상 `null` 이다. 지금 안전한 실제 이유는
    **첫 렌더 결과가 `snapshot` 에 의존하지 않는다**는 것이다: job 프리페치가 없어
    `query.data === undefined` 이고 반드시 진행 분기로 간다.

    **프리페치나 `HydrationBoundary` 를 붙이거나 진행 분기에서 조건을 그리기 시작하면
    그 순간 mismatch 가 된다.** 그때는 읽기를 effect 로 옮긴다.
  */
  const [stored] = useState<AiPlanRequestSnapshot | null>(() => readAiPlanRequest(jobId))

  const job = query.data ?? null
  const draft = job?.planDraft ?? null

  /*
    **이름은 회원의 반려견 목록에서 맞춘다** (#498). 서버 조건은 `petIds` 만 주는데, 이름이
    비면 일정 제목 기본값이 `제주 3일 여행` 으로 떨어져 **같은 초안을 어느 브라우저에서
    담느냐에 따라 제목이 갈린다.** 이 목록은 헤더 스위처가 쓰는 것과 **같은 key** 라
    `(main)` 레이아웃의 프리페치에 얹히고 새 요청이 나가지 않는다.
  */
  const petList = usePetList(authed)
  const petNameOf = useCallback(
    (petId: string) => petList.data?.pets.find((pet) => pet.petId === petId)?.name ?? '',
    [petList.data],
  )

  /*
    **조건은 두 곳에서 온다** (#498).

    `stored` 는 제출한 그 탭의 `sessionStorage` 보관본이라 `pinnedPlaces`·`preferFavorites`
    까지 안다. `restored` 는 서버가 함께 내린 생성 조건(#488)이라 **담는 데 필요한 것만**
    안다 — 대신 **다른 브라우저·기기에서도 있다.**

    담기는 둘 중 있는 쪽으로 하고(보관본 우선), 재제출은 보관본으로만 한다 — 아래
    `AiPlanFailedContainer` 주석 참고.
  */
  const restored = useMemo(
    () => snapshotFromConditions(job?.conditions ?? null, petNameOf),
    [job?.conditions, petNameOf],
  )
  const snapshot = stored ?? restored

  const { metaLines, coords, delistedPlaceIds } = useDraftPlaces(draft)

  const conditionSummary = useMemo(() => summarize(snapshot), [snapshot])

  // ── 1·2. 조회 실패 ─────────────────────────────────────────────────────

  /*
    **폴링 중 일시 실패로 진행 화면을 지우지 않는다.** `retry: false` 라 주기 하나가
    5xx·무응답이면 즉시 `query.error` 가 채워지는데, 다음 주기(2초)가 성공하면 되돌아온다
    — 전체를 `ErrorState` 로 바꾸면 그 사이 에러 화면이 깜빡인다. **한 번도 못 받았을
    때만** 전체 오류로 간다 (명세 S4 "폴링 요청 자체가 5xx 면 다음 주기에 자연히 다시
    시도한다").
  */
  if (query.error !== null && job === null) {
    const status = query.error instanceof ApiError ? query.error.status : null

    /*
      **404 에 재시도 버튼을 주지 않는다.** 타인·없는 `jobId` 는 다시 불러도 없다
      (`AIPLAN_002`). 새로 만들기로 보낸다.
    */
    if (status === 404) {
      return (
        <AiPlanJobShell>
          {/* 카드 안이라 인셋이 `card`(16/20)다 — 페이지 값 40 을 쓰면 내용이 두 번 밀린다 */}
          <EmptyState
            inset="card"
            title={messages.aiPlan.jobNotFoundTitle}
            description={messages.aiPlan.jobNotFoundDescription}
            action={
              <ButtonLink href="/ai-plans/new">{messages.aiPlan.jobNotFoundAction}</ButtonLink>
            }
          />
        </AiPlanJobShell>
      )
    }

    return (
      <AiPlanJobShell>
        <ErrorState
          inset="card"
          title={messages.aiPlan.jobErrorTitle}
          description={messages.aiPlan.jobErrorDescription}
          onRetry={() => void query.refetch()}
        />
      </AiPlanJobShell>
    )
  }

  // ── 4. 작업 실패 — HTTP 200 이다 ───────────────────────────────────────

  if (isJobFailed(job)) {
    return (
      <AiPlanJobShell>
        <AiPlanFailedContainer
          jobId={jobId}
          /*
            **재제출에는 보관본만 넘긴다** (#498). 서버 복원본에는 `pinnedPlaceIds`·
            `preferFavorites` 가 없어(계약에 아예 없다) 그대로 다시 내면 **꼭 넣으라고 고른
            장소가 조용히 빠진 초안**이 나온다 — 버튼이 말하는 "같은 조건" 이 거짓이 된다.
            `null` 이면 호출부가 버튼을 감추고 `조건 바꾸기` 로 폼에서 확인하게 한다.
          */
          snapshot={stored}
          conditionSummary={conditionSummary}
          errorMessage={job?.errorMessage ?? null}
          errorCode={job?.errorCode ?? null}
        />
      </AiPlanJobShell>
    )
  }

  // ── 5. 취소 — 실패가 아니다 (#250) ─────────────────────────────────────

  /*
    **`FAILED` 판정 뒤, 진행 판정 앞이다.** `CANCELED` 는 종결이라 `polling` 이 false 이고,
    이 분기가 없으면 완료 분기로 흘러 초안 없음(`emptyDraft`) 화면이 뜬다 — 사용자가
    그만둔 것을 "만들어진 일정이 없어요" 라고 말하게 된다.
  */
  if (isJobCanceled(job)) {
    return (
      <AiPlanJobShell>
        <AiPlanCanceledContainer
          jobId={jobId}
          // 실패 화면과 같은 이유로 보관본만이다 (#498)
          snapshot={stored}
          conditionSummary={conditionSummary}
        />
      </AiPlanJobShell>
    )
  }

  // ── 3. 진행 중 ─────────────────────────────────────────────────────────

  if (job === null || polling) {
    return (
      <AiPlanJobShell>
        <AiPlanProgress
          inset="card"
          status={job?.status ?? null}
          step={job?.step ?? null}
          stepProgress={jobStepProgress(job)}
          phase={phase}
          onRecheck={recheck}
          rechecking={query.isFetching}
          /*
            **첫 응답 전에는 그만둘 수 없다.** 아직 서버가 이 `jobId` 를 아는지조차 확인되지
            않았고, 취소는 404 로 떨어질 뿐이다 — 누를 수 없는 버튼을 그리는 대신 뺀다.
          */
          onCancel={job === null ? null : cancel}
          canceling={canceling}
          cancelFailed={cancelFailed}
        />
      </AiPlanJobShell>
    )
  }

  // ── 6. 완료 ────────────────────────────────────────────────────────────

  if (draft === null) {
    // `COMPLETED` 인데 초안이 없다 — 계약상 오지 않아야 하지만 화면이 비어 죽지 않게 한다
    return (
      <AiPlanJobShell>
        <EmptyState
          inset="card"
          title={messages.aiPlan.emptyDraftTitle}
          description={messages.aiPlan.emptyDraftDescription}
          action={<ButtonLink href="/ai-plans/new">{messages.aiPlan.jobNotFoundAction}</ButtonLink>}
        />
      </AiPlanJobShell>
    )
  }

  if (snapshot === null) {
    /*
      **조건을 잃으면 담기를 막는다** (명세 S5 함정 1). 초안을 보여 주되 담을 수 없다고
      말한다 — 다른 기기에서 같은 URL 을 열면 실제로 이 상태가 된다.
    */
    return (
      <AiPlanJobShell bare>
        <AiPlanDraftPreview
          draft={draft}
          title={messages.aiPlan.previewTitle}
          startDate=""
          endDate=""
          budget={null}
          totalDays={null}
          metaLines={metaLines}
          coords={coords}
          delistedPlaceIds={delistedPlaceIds}
          excludedPlaceIds={EMPTY_SET}
        />

        {/*
          **담기 패널이 서던 자리다.** 카드 밖 L0 이고 인셋만 카드 안 글줄과 같은 축이라
          위 카드의 첫 글자와 세로선이 맞는다 (`PlanDayRegenerateConfirm` 과 같은 처리).
          카드로 만들지 않는다 — 이 자리는 액션 슬롯이고, 여기 오는 것은 "왜 담을 수
          없는가" 한 줄이라 §0 판정 3문의 ③(담는 항목이 둘 이상)을 통과하지 못한다.
        */}
        <EmptyState
          inset="card"
          title={messages.aiPlan.conditionLostTitle}
          description={messages.aiPlan.conditionLostDescription}
          action={
            <ButtonLink href="/ai-plans/new">{messages.aiPlan.conditionLostAction}</ButtonLink>
          }
        />
      </AiPlanJobShell>
    )
  }

  return (
    <AiPlanJobShell bare>
      <AiPlanCommitContainer
        jobId={jobId}
        draft={draft}
        snapshot={snapshot}
        metaLines={metaLines}
        coords={coords}
        delistedPlaceIds={delistedPlaceIds}
      />
    </AiPlanJobShell>
  )
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/**
 * 모든 상태가 공유하는 껍데기 — `h1` + L1 카드 하나 (`DESIGN.md §0`, #473).
 *
 * **여섯 상태 전부에 `h1` 이 있어야 한다.** 없으면 문서의 최상위 제목이 진행 표시의 `h2`
 * 가 되어 스크린리더 사용자가 무슨 화면인지 알 수 없다 (하루 재생성 #451 과 같은 판단 —
 * 이 화면은 옮기기 전까지 `h1` 이 아예 없었다).
 *
 * **머리는 카드가 아니다** — 페이지 머리(h1)는 §0 의 카드 판정에서 빠진다 (장소 상세
 * #443 · 일정 상세 #447 · 하루 재생성 #451 과 같은 결정). 인셋만 카드 안 글줄과 같은
 * 축으로 둬서 아래 카드의 첫 글자와 세로선이 맞는다.
 *
 * **본문은 카드 하나다.** 404 · 조회 오류 · 대기 · 작업 실패 · 취소 · 빈 초안이 전부 같은
 * 화자("이 작업이 어떻게 되고 있는가")가 이어 말하는 것이라 한 카드에 든다 (§0 "카드
 * 경계는 이야기 단위"). 상태마다 카드를 따로 그리면 하나를 빠뜨렸을 때 카드가 생겼다
 * 사라진다 (#440 판단). 머리가 이름을 이미 그리므로 카드는 `aria-label` 만 갖는다.
 *
 * **폭은 옮기기 전 값(768) 그대로다.** `/ai-plans/new` 는 폼 규약(#453)을 따라 672 지만,
 * 이 화면은 완료 상태에서 일자 카드가 여럿 서는 목록형이라 좁히면 한 행에 드는 글자가
 * 준다 — 폭을 바꾸는 것은 이 이슈가 요구한 변경이 아니다.
 */
function AiPlanJobShell({
  /**
   * `children` 이 **이미 자기 카드를 그린다** — 껍데기가 다시 감싸지 않는다.
   *
   * 완료 상태 하나뿐이다: 초안 개요와 일자마다가 각자 L1 카드이고 담기 패널은 액션이라
   * 카드가 아니다. 카드 안에 카드를 넣으면 §0 의 "층마다 다른 채널" 이 깨진다.
   */
  bare = false,
  children,
}: {
  bare?: boolean
  children: ReactNode
}) {
  return (
    <SurfaceStack className="mx-auto w-full max-w-screen-md">
      {/* 데스크톱 세로 여백은 `SurfaceStack` 의 `md:p-6` 이 준다 (#451 머리와 같은 값) */}
      <header className={cn('pt-4 pb-4 md:pt-0 md:pb-0', INSET_CLASS.card)}>
        {/* 화면 제목과 탭 제목이 같은 키를 쓴다 (R7) */}
        <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
          {messages.aiPlan.jobTitle}
        </h1>
      </header>

      {bare ? children : <Surface aria-label={messages.aiPlan.jobTitle}>{children}</Surface>}
    </SurfaceStack>
  )
}

/**
 * 좁힌 지역이 원인일 수 있다는 단서 (#251). 붙일 이유가 없으면 null 이다.
 *
 * **라벨은 장소 찾기와 같은 표에서 가져온다** — 같은 코드에 두 이름이 생기면 조건 입력에서
 * 고른 이름과 실패 화면이 말하는 이름이 달라진다. 표에 없는 코드(원천에 남은 폐지 시군구)면
 * 이름을 지어내지 않고 단서를 생략한다.
 */
function narrowedRegionHint(
  errorCode: string | null,
  snapshot: AiPlanRequestSnapshot | null,
): string | null {
  const sigunguCode = snapshot?.sigunguCode ?? null
  if (!isNarrowedRegionFailure(errorCode, sigunguCode)) return null

  const region = SIGUNGU_LABEL[sigunguCode ?? '']
  if (region === undefined) return null

  return messages.aiPlan.failedNarrowedRegion.replace('{region}', region)
}

/** 실패 화면 — 같은 조건으로 재제출을 담당한다 */
function AiPlanFailedContainer({
  jobId,
  snapshot,
  conditionSummary,
  errorMessage,
  errorCode,
}: {
  jobId: string
  snapshot: AiPlanRequestSnapshot | null
  conditionSummary: string | null
  errorMessage: string | null
  errorCode: string | null
}) {
  const { resubmit, retrying } = useAiPlanResubmit(snapshot)

  return (
    <AiPlanFailed
      // 카드 안이다 — 껍데기가 이미 `Surface` 를 그렸다 (§0)
      inset="card"
      errorMessage={errorMessage}
      hint={narrowedRegionHint(errorCode, snapshot)}
      conditionSummary={conditionSummary}
      onRetry={resubmit}
      retrying={retrying}
      changeHref={`/ai-plans/new?from=${encodeURIComponent(jobId)}`}
    />
  )
}

/**
 * 취소 화면 (#250) — 실패와 **같은 재제출**을 쓴다.
 *
 * 두 화면이 하는 일이 같기 때문이다: 보관한 조건으로 새 작업을 낸다. 다른 것은 **무엇을
 * 말하는가**뿐이라 문구와 갈래만 갈라 놓는다.
 */
function AiPlanCanceledContainer({
  jobId,
  snapshot,
  conditionSummary,
}: {
  jobId: string
  snapshot: AiPlanRequestSnapshot | null
  conditionSummary: string | null
}) {
  const { resubmit, retrying } = useAiPlanResubmit(snapshot)

  return (
    <AiPlanCanceled
      // 카드 안이다 — 껍데기가 이미 `Surface` 를 그렸다 (§0)
      inset="card"
      conditionSummary={conditionSummary}
      onRetry={resubmit}
      retrying={retrying}
      changeHref={`/ai-plans/new?from=${encodeURIComponent(jobId)}`}
    />
  )
}

/** 완료 — 미리보기 + 담기 */
function AiPlanCommitContainer({
  jobId,
  draft,
  snapshot,
  metaLines,
  coords,
  delistedPlaceIds,
}: {
  jobId: string
  draft: AiPlanDraft
  snapshot: AiPlanRequestSnapshot
  metaLines: ReadonlyMap<string, string>
  coords: ReadonlyMap<string, LatLng>
  delistedPlaceIds: ReadonlySet<string>
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const totalDays = totalDaysBetween(snapshot.startDate, snapshot.endDate)

  /*
    **판정 기준 반려견 선택이 여기 있었다** (#128 · 다견선택-세부명세 D4). `PlanCreateRequest.petId`
    가 단일이라 여러 마리로 만든 초안이 저장되는 순간 한 마리가 되던 것을 숨기지 않으려는
    장치였는데, #152 가 `petIds` 를 받으면서 그 제약이 사라져 걷었다 (#174).

    이제 `draftToPlanPayload` 가 `snapshot.pets` 를 그대로 싣고 **첫 번째가 대표**가 된다 —
    조건 입력에서 체크한 순서가 저장까지 그대로 간다.
  */
  const [excludedPlaceIds, setExcludedPlaceIds] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [delistedBlocked, setDelistedBlocked] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  const form = useForm<{ title: string }, PlanDetail>({
    schema: aiPlanCommitSchema,
    initialValues: {
      // 기본값을 넣어 두고 담기 직전에 고칠 수 있게 한다 (명세 S8 미결 1)
      title: defaultPlanTitle(petNamesLabel(snapshot.pets), totalDays ?? draft.days.length),
    },
    /*
      **`PLAN_004` 를 여기서 잡는다.** `useForm` 은 오류를 `errors` 로만 남기고 원본
      예외를 돌려주지 않아, 호출부가 코드를 볼 수 있는 곳이 `onSubmit` 안뿐이다.
      잡은 뒤 **다시 던진다** — 폼도 실패를 알아야 제출 버튼이 풀린다.
    */
    onSubmit: async (values) => {
      setDelistedBlocked(false)

      try {
        return await createPlan(
          draftToPlanPayload({
            draft,
            snapshot,
            title: values.title.trim(),
            totalDays,
            excludedPlaceIds,
          }),
        )
      } catch (error) {
        if (isDelistedFailure(error)) setDelistedBlocked(true)
        throw error
      }
    },
    onSuccess: (plan) => {
      /*
        담으면 초안이 되고 **소유권이 plan-service 로 넘어간다.** 조건 보관은 여기서
        끝이라 지운다 — 뒤로가기로 돌아와 같은 초안을 두 번 담는 것도 막는다.
      */
      clearAiPlanRequest(jobId)
      void queryClient.invalidateQueries({ queryKey: planKeys.all })

      /*
        **방금 담은 일정으로 보낸다.** 목록이 아니다 — 담기의 결과를 바로 확인해야
        일자·항목이 의도대로 들어갔는지 알 수 있고, 초안 상태라 확정·수정도 거기서 한다.
        직접 만들기(`PlanCreateFormContainer`)와 같은 목적지다 (plan 공통명세 S9).

        `#80`(일정 상세)이 머지되기 전에는 이 경로가 404 라 목록으로 보내고 있었다.
      */
      router.replace(`/plans/${plan.planId}`)
    },
  })

  /*
    **셋을 `SurfaceStack` 의 직접 자식으로 내보낸다** (#473). 예전에는 담기 패널을
    `AiPlanDraftPreview` 의 `footer` 로 넘겨 미리보기가 남의 것을 자기 아래에 그렸는데,
    3a 에서는 미리보기가 **카드 여럿**이 되고 담기 패널은 **액션이라 카드가 아니다** —
    카드 안에 액션을 두면 초안의 마지막 일자 카드에 담기 폼이 딸려 들어간다.
    **배치 책임을 담는 쪽(여기)이 갖는다**: #464 가 `PetForm` 의 `footer` 를 걷고 삭제
    영역의 배치를 `PetEditView` 로 옮긴 것과 같은 이동이다.

    래퍼(`div`)로 묶지 않는다 — 묶으면 카드 사이 간격을 스택이 주지 못한다 (#451 이
    비교 두 열을 fragment 로 내보낸 것과 같은 이유).
  */
  return (
    <>
      <AiPlanDraftPreview
        draft={draft}
        title={form.values.title}
        startDate={snapshot.startDate}
        endDate={snapshot.endDate}
        budget={snapshot.budget}
        totalDays={totalDays}
        metaLines={metaLines}
        coords={coords}
        delistedPlaceIds={delistedPlaceIds}
        excludedPlaceIds={excludedPlaceIds}
      />

      <AiPlanCommitPanel
        title={form.values.title}
        errors={form.errors}
        submitting={form.isSubmitting}
        delistedBlocked={delistedBlocked}
        hasDelisted={delistedPlaceIds.size > 0}
        excludedCount={excludedPlaceIds.size}
        onTitleChange={(title) => form.setValue('title', title)}
        onSubmit={() => void form.submit()}
        onExcludeDelisted={() => {
          setExcludedPlaceIds(new Set(delistedPlaceIds))
          setDelistedBlocked(false)
          /*
            **직전 실패의 서버 문구를 함께 지운다.** 안 지우면 사용자가 이미 조치한
            오류("일정에 포함된 장소를 찾을 수 없습니다")가 "N개 항목을 빼고 담아요"
            옆에 남아, 방금 고친 것이 아직 문제인 것처럼 보인다 (실렌더에서 잡았다).
          */
          form.setErrors(NO_FORM_ERRORS)
        }}
        onResetExcluded={() => setExcludedPlaceIds(EMPTY_SET)}
        onDiscard={() => setDiscarding(true)}
        againHref={`/ai-plans/new?from=${encodeURIComponent(jobId)}`}
      />

      <ConfirmModal
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => {
          clearAiPlanRequest(jobId)
          router.replace('/ai-plans/new')
        }}
        title={messages.aiPlan.discardConfirmTitle}
        description={messages.aiPlan.discardConfirmDescription}
        confirmLabel={messages.aiPlan.discardConfirm}
        destructive
      />
    </>
  )
}

/** 실패 화면이 "그대로 남아 있는 조건" 으로 보여 줄 요약. 조건이 없으면 null */
function summarize(snapshot: AiPlanRequestSnapshot | null): string | null {
  if (snapshot === null) return null

  const parts = [formatPlanDateRange(snapshot.startDate, snapshot.endDate)]

  const names = petNamesLabel(snapshot.pets)
  if (names !== '') parts.push(names)

  const budget = formatBudget(snapshot.budget)
  if (budget !== null) parts.push(budget)

  return parts.join(' · ')
}
