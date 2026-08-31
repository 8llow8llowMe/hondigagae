'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { ButtonLink } from '@/components/button'
import { ConfirmModal } from '@/components/confirm-modal'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { AiPlanCommitPanel } from '@/features/ai-plan/ai-plan-commit-panel'
import { AiPlanDraftPreview } from '@/features/ai-plan/ai-plan-draft-preview'
import { AiPlanFailed } from '@/features/ai-plan/ai-plan-failed'
import { AiPlanProgress } from '@/features/ai-plan/ai-plan-progress'
import { aiPlanCommitSchema } from '@/features/ai-plan/schemas'
import { useAiPlanJob } from '@/features/ai-plan/use-ai-plan-job'
import { useDraftPlaces } from '@/features/ai-plan/use-draft-places'
import { planKeys } from '@/features/plan/queries'
import { formatBudget } from '@/lib/ai-plan/budget'
import { defaultPlanTitle } from '@/lib/ai-plan/draft-title'
import { draftToPlanPayload } from '@/lib/ai-plan/draft-to-plan'
import { isJobFailed } from '@/lib/ai-plan/job'
import {
  clearAiPlanRequest,
  readAiPlanRequest,
  saveAiPlanRequest,
} from '@/lib/ai-plan/request-store'
import { submitAiPlan } from '@/lib/api/ai-plan'
import { ApiError } from '@/lib/api/error'
import { createPlan } from '@/lib/api/plan'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { formatPlanDateRange, totalDaysBetween } from '@/lib/plan/date'
import type { AiPlanDraft, AiPlanRequestSnapshot } from '@/types/ai-plan'
import type { PlanDetail } from '@/types/plan'

/** 담기가 `PLAN_004` 로 막혔는가 — delisting 된 장소가 초안에 있다 */
function isDelistedFailure(error: unknown): boolean {
  return error instanceof ApiError && error.resultCode === 'PLAN_004'
}

/**
 * 생성 대기 · 결과 — 명세 S0 · S4 · S6 · S7.
 *
 * 상태 다섯을 여기서 가른다:
 *  1. 조회 실패 404(`AIPLAN_002`) → `not-found` 성격, **재시도를 주지 않는다**
 *  2. 조회 실패 그 외 → `ErrorState` + 재시도
 *  3. `PENDING`/`RUNNING`(+ 상한) → 진행 표시
 *  4. `FAILED` (**HTTP 200**) → `AiPlanFailed`
 *  5. `COMPLETED` → 미리보기 + 담기
 */
export function AiPlanJobView({ jobId }: { jobId: string }) {
  const { query, phase, polling, recheck } = useAiPlanJob(jobId)

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
  const [snapshot] = useState<AiPlanRequestSnapshot | null>(() => readAiPlanRequest(jobId))

  const job = query.data ?? null
  const draft = job?.planDraft ?? null

  const { addresses, coords, delistedPlaceIds } = useDraftPlaces(draft)

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
        <EmptyState
          title={messages.aiPlan.jobNotFoundTitle}
          description={messages.aiPlan.jobNotFoundDescription}
          action={<ButtonLink href="/ai-plans/new">{messages.aiPlan.jobNotFoundAction}</ButtonLink>}
        />
      )
    }

    return (
      <ErrorState
        title={messages.aiPlan.jobErrorTitle}
        description={messages.aiPlan.jobErrorDescription}
        onRetry={() => void query.refetch()}
      />
    )
  }

  // ── 4. 작업 실패 — HTTP 200 이다 ───────────────────────────────────────

  if (isJobFailed(job)) {
    return (
      <AiPlanFailedContainer
        jobId={jobId}
        snapshot={snapshot}
        conditionSummary={conditionSummary}
        errorMessage={job?.errorMessage ?? null}
      />
    )
  }

  // ── 3. 진행 중 ─────────────────────────────────────────────────────────

  if (job === null || polling) {
    return (
      <AiPlanProgress
        status={job?.status ?? null}
        phase={phase}
        onRecheck={recheck}
        rechecking={query.isFetching}
      />
    )
  }

  // ── 5. 완료 ────────────────────────────────────────────────────────────

  if (draft === null) {
    // `COMPLETED` 인데 초안이 없다 — 계약상 오지 않아야 하지만 화면이 비어 죽지 않게 한다
    return (
      <EmptyState
        title={messages.aiPlan.emptyDraftTitle}
        description={messages.aiPlan.emptyDraftDescription}
        action={<ButtonLink href="/ai-plans/new">{messages.aiPlan.jobNotFoundAction}</ButtonLink>}
      />
    )
  }

  if (snapshot === null) {
    /*
      **조건을 잃으면 담기를 막는다** (명세 S5 함정 1). 초안을 보여 주되 담을 수 없다고
      말한다 — 다른 기기에서 같은 URL 을 열면 실제로 이 상태가 된다.
    */
    return (
      <AiPlanDraftPreview
        draft={draft}
        title={messages.aiPlan.previewTitle}
        startDate=""
        endDate=""
        budget={null}
        totalDays={null}
        addresses={addresses}
        coords={coords}
        delistedPlaceIds={delistedPlaceIds}
        excludedPlaceIds={EMPTY_SET}
        footer={
          <EmptyState
            title={messages.aiPlan.conditionLostTitle}
            description={messages.aiPlan.conditionLostDescription}
            action={
              <ButtonLink href="/ai-plans/new">{messages.aiPlan.conditionLostAction}</ButtonLink>
            }
          />
        }
      />
    )
  }

  return (
    <AiPlanCommitContainer
      jobId={jobId}
      draft={draft}
      snapshot={snapshot}
      addresses={addresses}
      coords={coords}
      delistedPlaceIds={delistedPlaceIds}
    />
  )
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/** 실패 화면 — 같은 조건으로 재제출을 담당한다 */
function AiPlanFailedContainer({
  jobId,
  snapshot,
  conditionSummary,
  errorMessage,
}: {
  jobId: string
  snapshot: AiPlanRequestSnapshot | null
  conditionSummary: string | null
  errorMessage: string | null
}) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  /*
    **같은 조건으로 다시 제출한다.** 재생성 API 가 아니라 `POST /ai-plans` 새 제출이다.
    서버가 멱등하지만 실패한 작업은 진행 중이 아니므로 **새 `jobId` 가 나온다.**
  */
  async function retry(): Promise<void> {
    if (snapshot === null) return

    setRetrying(true)
    try {
      const result = await submitAiPlan({
        areaCode: snapshot.areaCode,
        startDate: snapshot.startDate,
        endDate: snapshot.endDate,
        petId: snapshot.petId,
        ...(snapshot.budget === null ? {} : { budget: snapshot.budget }),
        ...(snapshot.requestNote === '' ? {} : { requestNote: snapshot.requestNote }),
      })

      // 새 작업에도 같은 조건을 붙여 둔다 — 담기가 다시 필요하다
      saveAiPlanRequest(result.jobId, snapshot)

      router.replace(`/ai-plans/jobs/${result.jobId}`)
    } catch {
      // 제출 실패는 폼이 없어 필드에 붙일 수 없다. 버튼을 되살려 다시 누를 수 있게 한다
      setRetrying(false)
    }
  }

  return (
    <AiPlanFailed
      errorMessage={errorMessage}
      conditionSummary={conditionSummary}
      onRetry={snapshot === null ? null : () => void retry()}
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
  addresses,
  coords,
  delistedPlaceIds,
}: {
  jobId: string
  draft: AiPlanDraft
  snapshot: AiPlanRequestSnapshot
  addresses: ReadonlyMap<string, string>
  coords: ReadonlyMap<string, LatLng>
  delistedPlaceIds: ReadonlySet<string>
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const totalDays = totalDaysBetween(snapshot.startDate, snapshot.endDate)

  const [excludedPlaceIds, setExcludedPlaceIds] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [delistedBlocked, setDelistedBlocked] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  const form = useForm<{ title: string }, PlanDetail>({
    schema: aiPlanCommitSchema,
    initialValues: {
      // 기본값을 넣어 두고 담기 직전에 고칠 수 있게 한다 (명세 S8 미결 1)
      title: defaultPlanTitle(snapshot.petName, totalDays ?? draft.days.length),
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

  return (
    <AiPlanDraftPreview
      draft={draft}
      title={form.values.title}
      startDate={snapshot.startDate}
      endDate={snapshot.endDate}
      budget={snapshot.budget}
      totalDays={totalDays}
      addresses={addresses}
      coords={coords}
      delistedPlaceIds={delistedPlaceIds}
      excludedPlaceIds={excludedPlaceIds}
      footer={
        <>
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
      }
    />
  )
}

/** 실패 화면이 "그대로 남아 있는 조건" 으로 보여 줄 요약. 조건이 없으면 null */
function summarize(snapshot: AiPlanRequestSnapshot | null): string | null {
  if (snapshot === null) return null

  const parts = [formatPlanDateRange(snapshot.startDate, snapshot.endDate)]
  if (snapshot.petName !== '') parts.push(snapshot.petName)

  const budget = formatBudget(snapshot.budget)
  if (budget !== null) parts.push(budget)

  return parts.join(' · ')
}
