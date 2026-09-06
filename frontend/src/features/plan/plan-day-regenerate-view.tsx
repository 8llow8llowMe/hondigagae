'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { BackLink } from '@/components/back-link'
import { Button, ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Skeleton } from '@/components/skeleton'
import { Textarea } from '@/components/textarea'
import { AiPlanFailed } from '@/features/ai-plan/ai-plan-failed'
import { AiPlanProgress } from '@/features/ai-plan/ai-plan-progress'
import { useAiPlanJob } from '@/features/ai-plan/use-ai-plan-job'
import { useDraftPlaces } from '@/features/ai-plan/use-draft-places'
import { PlanDayDiff, type PlanDayDiffRow } from '@/features/plan/plan-day-diff'
import { PlanDayRegenerateConfirm } from '@/features/plan/plan-day-regenerate-confirm'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { planKeys } from '@/features/plan/queries'
import { usePlanDetail } from '@/features/plan/use-plan-detail'
import { isJobFailed, jobStepProgress } from '@/lib/ai-plan/job'
import {
  dayRegenerateBlock,
  toDayRegeneratePayload,
  toRegeneratedDayItems,
} from '@/lib/ai-plan/regenerate'
import { submitAiPlan } from '@/lib/api/ai-plan'
import { ApiError } from '@/lib/api/error'
import { replaceDayItems } from '@/lib/api/plan'
import { toMessage } from '@/lib/api/response'
import { messages } from '@/lib/messages'
import { groupItemsByDay } from '@/lib/plan/detail'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
import type { AiPlanDraft } from '@/types/ai-plan'
import type { PlanDetail, PlanItemDetail, PlanItemRequest } from '@/types/plan'

/**
 * 하루 재생성 — 하루재생성-세부명세 R2 · R4 · R5.
 *
 * **한 화면의 세 상태이지 세 화면이 아니다** (R2-1). `planId` + `day` 가 이 작업의
 * 신원이고 `jobId` 는 그 안에서 잠깐 생기는 상태다 — 그래서 경로가 아니라 쿼리다.
 *
 * ```text
 * …/regenerate            제출 (메모 입력)
 * …/regenerate?jobId=…    대기 → 비교 → 확정
 * ```
 *
 * **`sessionStorage` 스냅샷을 쓰지 않는다** (R2-2). 생성 경로가 스냅샷을 쓰는 이유는
 * 담기(`POST /plans`)를 되살릴 조건이 초안에도 작업 응답에도 없기 때문인데, 여기서는
 * `planId` 가 그 역할을 한다 — 조건이 전부 일정에서 다시 나오고 되붙이기에는 항목만
 * 있으면 된다. 보관할 것이 없으므로 보관하지 않는다.
 */
export function PlanDayRegenerateView({
  planId,
  day,
  today,
}: {
  planId: string
  day: number
  /**
   * 서버가 만든 ISO 시각 (#128). **클라이언트가 따로 `new Date()` 를 부르지 않는다** —
   * 자정 근처에서 서버 렌더와 하이드레이션의 판정이 하루 갈린다 (일정 상세와 같은 결정).
   */
  today: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const detail = usePlanDetail(planId)

  // `jobId` 는 쿼리다 (R2-1). 제출 성공이 `router.replace` 로 붙인다
  const jobId = searchParams.get('jobId')

  const plan = detail.data ?? null

  /*
    **기간 상한은 뷰가 판단한다** (R2). 라우트는 `totalDays` 를 모르므로 `notFound()` 로
    낼 수 없다 — 상세를 받은 여기서 일정으로 돌려보낸다. 주소를 손으로 고쳐 들어올 수
    있으므로 서버에서 막을 수 없다.
  */
  const outOfRange = plan !== null && day > plan.totalDays

  useEffect(() => {
    if (outOfRange) router.replace(`/plans/${planId}`)
  }, [outOfRange, planId, router])

  const backHref = `/plans/${planId}#${planDayAnchorId(day)}`

  /*
    **`return null` 이 아니라 껍데기를 세운다.** 이 세그먼트에는 `loading.tsx` 를
    의도적으로 두지 않았으므로(soft 404 회피) 여기서 비우면 프리페치가 실패했을 때
    화면이 통째로 빈다. 제목은 `day` 만으로 쓸 수 있어 기다릴 이유가 없다.
  */
  if (detail.isPending) {
    return (
      <RegenerateShell day={day} backHref={backHref}>
        <div aria-hidden className="flex flex-col gap-3 px-4 py-6 md:px-10">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
      </RegenerateShell>
    )
  }

  if (plan === null) {
    /*
      404 는 라우트가 이미 걸렀다 — 여기 오는 것은 폴링 없는 단발 조회의 일시 장애다.
      **`ErrorState` + 재시도** (api-integration-guide.md §3).
    */
    return (
      <RegenerateShell day={day} backHref={backHref}>
        <ErrorState
          title={messages.plan.detailErrorTitle}
          description={messages.plan.errorDescription}
          onRetry={() => void detail.refetch()}
        />
      </RegenerateShell>
    )
  }

  // 없는 일자다 — 위 effect 가 일정으로 보내는 중이라 화면을 세우지 않는다 (R2)
  if (outOfRange) return null

  /*
    **제출의 두 전제를 화면이 먼저 말한다** (R6). `POST /ai-plans` 는 재생성 검증 앞에서
    시작일(`AIPLAN_017`)과 일수(`AIPLAN_018`)를 보고, 제출 본문은 이 일정의 기간을 그대로
    싣는다 — 막힌 일정에서는 무엇을 눌러도 400 이다.

    **진입점을 감추는 것만으로 끝나지 않는다** (`plan-detail-section.tsx`) — 주소를 손으로
    넣거나 북마크로 들어올 수 있어 여기서도 본다. **없는 일자처럼 되돌려 보내지 않는다**:
    그쪽은 주소가 틀린 경우라 말없이 보내도 되지만, 여기는 주소가 맞고 그 날도 있으므로
    말없이 튕기면 버튼이 고장 난 것처럼 보인다 — **이유를 말한다.**

    이 전제는 제출(`POST /ai-plans`)의 것이고 적용 경로(`PUT /plans/{id}/days/{day}/items`)에는
    없다 — 이미 받아 둔 초안을 자정이 지났다는 이유로 버리지 않는다. 그래서 `jobId === null`
    (제출 화면)일 때만 본다 — 대기·비교·적용 단계는 이 판을 거치지 않는다.
  */
  const block = dayRegenerateBlock(plan, new Date(today))
  if (jobId === null && block !== null) {
    return (
      <RegenerateShell day={day} backHref={backHref} planTitle={plan.title}>
        <EmptyState
          title={
            block === 'START_DATE_IN_PAST'
              ? messages.plan.regenerateDayPastPlan
              : messages.plan.regenerateDayTooLong
          }
          action={
            <ButtonLink href={backHref} variant="secondary">
              {messages.plan.addPlaceBack}
            </ButtonLink>
          }
        />
      </RegenerateShell>
    )
  }

  return (
    <RegenerateShell day={day} backHref={backHref} planTitle={plan.title}>
      {jobId === null ? (
        <RegenerateSubmit plan={plan} day={day} />
      ) : (
        <RegenerateJob plan={plan} day={day} jobId={jobId} />
      )}
    </RegenerateShell>
  )
}

/**
 * 모든 상태가 공유하는 껍데기 — 뒤로가기 · `h1`.
 *
 * **오류·대기에도 `h1` 이 있어야 한다.** 없으면 문서의 최상위 제목이 진행 표시의
 * `h2` 가 되어 스크린리더 사용자가 무슨 화면인지 알 수 없다 (담기 화면과 같은 판단).
 */
function RegenerateShell({
  day,
  backHref,
  planTitle,
  children,
}: {
  day: number
  backHref: string
  /** 아직 못 받았으면 생략한다 — 제목은 `day` 만으로 쓸 수 있다 */
  planTitle?: string
  children: ReactNode
}) {
  return (
    <>
      <header className="px-4 pt-5 pb-3 md:px-10 lg:pt-6">
        {/*
          **`addPlaceBack` 을 그대로 쓴다** — 문구가 `일정으로 돌아가기` 로 화면에
          매이지 않았고 목적지도 같다. 같은 말을 위한 키를 새로 만들지 않는다.
        */}
        <BackLink href={backHref} label={messages.plan.addPlaceBack} className="-ml-1" />
        <h1 className="text-title-1 text-fg lg:text-display mt-1 font-bold lg:font-extrabold">
          {/* 화면 제목과 탭 제목이 같은 키를 쓴다 (R7) */}
          {messages.plan.regenerateDayPageTitle.replace('{day}', String(day))}
        </h1>
        {planTitle !== undefined && (
          <p className="text-caption text-fg-muted mt-1 font-medium">{planTitle}</p>
        )}
      </header>

      {children}
    </>
  )
}

/** 제출 — 메모 하나뿐이다. 나머지 조건은 전부 일정에서 나온다 (R3) */
function RegenerateSubmit({ plan, day }: { plan: PlanDetail; day: number }) {
  const router = useRouter()

  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 제출을 막는다 (form-guide.md §6)
  const submittingRef = useRef(false)

  async function submit(): Promise<void> {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)

    try {
      const result = await submitAiPlan(toDayRegeneratePayload(plan, day, note))

      /*
        **`push` 가 아니라 `replace` 다.** 제출은 끝난 단계다 — 히스토리에 남기면 뒤로
        가기가 이미 제출한 화면으로 돌아가고, 멱등이라 같은 작업을 다시 받게 된다.
        뒤로 가기는 제출 전(일정 상세)으로 가야 한다.
      */
      router.replace(
        `/plans/${plan.planId}/days/${day}/regenerate?jobId=${encodeURIComponent(result.jobId)}`,
      )
    } catch (cause) {
      /*
        **서버 문구를 그대로 보여 준다** (R6). 일차 범위(`AIPLAN_014`/`015`)는 화면이
        `totalDays` 를 알아 애초에 안 나야 하고, 나면 서버가 이유를 가장 정확히 안다.
        `resultMessage` 는 백엔드 타입이 `Object` 라 `toMessage` 로 정규화한다.
      */
      setError(
        cause instanceof ApiError
          ? toMessage(cause.rawMessage, messages.plan.errorDescription)
          : messages.plan.errorDescription,
      )
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-4 px-4 py-2 md:px-10">
      <Field id="regenerateNote" label={messages.plan.regenerateDayNoteLabel} className="w-full">
        <Textarea
          id="regenerateNote"
          rows={3}
          value={note}
          onValueChange={setNote}
          placeholder={messages.plan.regenerateDayNotePlaceholder}
          /*
            **길이를 여기서 막는다.** `toDayRegeneratePayload` 는 자르지 않고
            (`toAiPlanSubmitPayload` 와 같은 분담) 서버는 500자 초과를 400 으로 돌려준다.
          */
          maxLength={500}
        />
      </Field>

      <FormAlert className="w-full" message={error} />

      <Button onClick={() => void submit()} loading={submitting}>
        {messages.plan.regenerateDaySubmit}
      </Button>
    </div>
  )
}

/**
 * 대기 → 비교 → 확정.
 *
 * **분기 순서를 `ai-plan-job-view.tsx` 에서 그대로 가져온다**: 조회 오류 → 작업 실패
 * → 진행 중 → 완료. **작업 실패가 진행 중보다 앞이다** — 실패는 HTTP 200 +
 * `status.code === 'FAILED'` 로 오므로(api-integration-guide.md §5) 순서를 바꾸면
 * 실패가 영원히 "진행 중" 으로 보인다.
 */
function RegenerateJob({ plan, day, jobId }: { plan: PlanDetail; day: number; jobId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { query, phase, polling, recheck } = useAiPlanJob(jobId)

  /** `PLAN_004` 로 막힌 장소. 초안을 버리지 않고 그 항목만 빼고 다시 담는다 (R6) */
  const [excludedPlaceIds, setExcludedPlaceIds] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [applying, setApplying] = useState(false)
  const [saveError, setSaveError] = useState<PlanDaySaveError | null>(null)
  const applyingRef = useRef(false)

  const job = query.data ?? null
  const draft = job?.planDraft ?? null

  /*
    **목표 일자의 장소만 확인한다.** 초안은 모든 날을 담아 오지만(R4) 되붙이는 것은
    이 하루뿐이라, 초안을 통째로 넘기면 쓰지도 않을 날의 장소를 전부 다시 조회한다.
  */
  const dayDraft = useMemo<AiPlanDraft | null>(
    () =>
      draft === null
        ? null
        : { days: draft.days.filter((entry) => entry.day === day), reasons: [] },
    [draft, day],
  )
  const { delistedPlaceIds, loading: placesLoading } = useDraftPlaces(dayDraft)

  /*
    **`null` 과 빈 배열의 뜻이 다르다** (R4-2). `null` 은 초안에 그 날이 없다는 뜻이고,
    빈 배열은 그 날이 있었는데 담을 항목이 남지 않았다는 뜻이다 — 빈 목록을 PUT 하면
    그 일자가 통째로 지워진다.
  */
  const nextItems = useMemo<PlanItemRequest[] | null>(
    () =>
      draft === null ? null : toRegeneratedDayItems(draft, day, plan.totalDays, excludedPlaceIds),
    [draft, day, plan.totalDays, excludedPlaceIds],
  )

  /** 제출 상태 — `?jobId=` 가 없는 이 화면의 주소다 */
  const submitHref = `/plans/${plan.planId}/days/${day}/regenerate`

  async function apply(items: PlanItemRequest[]): Promise<void> {
    if (applyingRef.current) return
    applyingRef.current = true
    setApplying(true)
    setSaveError(null)

    try {
      /*
        **`PlanItemRequest[]` 를 그대로 넘긴다.** `PlanDayItemsReplacePayload.items` 는
        `PlanItemPayload[]` 인데 두 타입은 `itemType` 만 다르고(`PlanItemTypeCode` ⊂
        `string`) 구조적으로 대입된다 — 옮겨 담는 함수를 만들면 매핑이 두 벌이 된다.
      */
      const next = await replaceDayItems(plan.planId, day, { items })

      /*
        **key 가 둘로 나뉘어 있어 둘 다 다룬다** (`queries.ts:12`). 상세는 응답이 통째로
        오므로 `setQueryData` 로 갈아끼우고, 판정은 그 날 **첫 장소 항목**을 기준으로
        나므로(컨트롤러 설명) 항목이 바뀌면 다시 받아야 한다.
      */
      queryClient.setQueryData(planKeys.detail(plan.planId), next)
      void queryClient.invalidateQueries({ queryKey: planKeys.weather(plan.planId) })

      // 끝난 작업을 히스토리에 남기지 않는다 (R8). 바꾼 일자로 앵커 스크롤한다
      router.replace(`/plans/${plan.planId}#${planDayAnchorId(day)}`)
    } catch (cause) {
      /*
        **`PLAN_004` 여도 초안을 버리지 않는다** (R6). 서버는 어느 장소인지 말해 주지
        않으므로 담기 화면과 같은 방식으로 짚는다 — 조회되지 않는 장소를 빼고 다시
        만든 항목으로 같은 버튼을 한 번 더 누르면 저장된다.
      */
      const excluded =
        cause instanceof ApiError && cause.resultCode === 'PLAN_004' ? delistedPlaceIds : EMPTY_SET

      if (excluded.size > 0) {
        setExcludedPlaceIds(new Set(excluded))
        /*
          **뺀 다음에는 다른 말을 한다.** 같은 `catch` 가 목록을 고치면서 편집모드 문구
          (*"목록에서 빼면 저장할 수 있어요"*)를 남기면, 이미 조치한 오류가 고쳐진 목록
          옆에 남아 방금 고친 것이 아직 문제인 것처럼 보인다 (담기 경로가 같은 함정에
          빠졌다 — `ai-plan-job-view.tsx:357`). 게다가 **여기서 빼는 것은 코드다** —
          `이렇게 바뀌어요` 열은 읽기 전용이라 사용자가 뺄 수 있는 것이 없다.
        */
        setSaveError({ message: messages.plan.regenerateDayExcludedPlace, retriable: false })
      } else {
        setSaveError(
          toPlanDaySaveError(cause, {
            retriable: messages.plan.errorDescription,
            /*
              **뺄 것을 못 찾은 `PLAN_004` 가 여기로 온다.** 화면이 지목할 항목이 없어
              고쳐 줄 수 없으니 사실을 그대로 말하는 편집모드 문구를 쓴다. *조회가 아직
              진행 중이라* 못 찾은 경우는 아래 확정 버튼이 그동안 잠겨 있어 여기 닿지
              않는다 — 여기 닿는 것은 조회가 끝났는데도 delisted 가 없는 경우다.
            */
            missingPlace: messages.plan.editMissingPlaceError,
          }),
        )
      }

      applyingRef.current = false
      setApplying(false)
    }
  }

  // ── 1. 조회 오류 ───────────────────────────────────────────────────────

  /*
    **폴링 중 일시 실패로 진행 화면을 지우지 않는다.** `retry: false` 라 주기 하나가
    5xx·무응답이면 즉시 `query.error` 가 채워지는데 다음 주기가 성공하면 되돌아온다.
    **한 번도 못 받았을 때만** 전체 오류로 간다 (`ai-plan-job-view.tsx` 와 같은 판단).
  */
  if (query.error !== null && job === null) {
    /*
      **404 에 재시도 버튼을 주지 않는다** (CLAUDE.md 절대 규칙 · api-integration-guide §3).
      `?jobId=` 가 주소에 있으므로 공유·북마크된 주소가 정리된 작업이나 남의 작업
      (`AIPLAN_002`)을 가리킬 수 있다 — 다시 불러도 없다.

      **`ai-plan-job-view` 와 목적지가 다르다.** 그쪽은 `/ai-plans/new` 로 보내지만
      여기서는 **일정이 그대로 있다** — 이 화면의 제출 상태로 돌려보내면 그 자리에서
      다시 만들 수 있다.
    */
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          title={messages.aiPlan.jobNotFoundTitle}
          description={messages.aiPlan.jobNotFoundDescription}
          action={
            <ButtonLink href={submitHref} variant="secondary">
              {messages.plan.regenerateDaySubmit}
            </ButtonLink>
          }
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

  // ── 2. 작업 실패 — HTTP 200 이다 ───────────────────────────────────────

  if (isJobFailed(job)) {
    /*
      **`ai-plan-failed` 를 그대로 쓴다** (R6). 재시도를 주지 않는 이유는 조건을 잃어서가
      아니라 **메모를 잃어서다** — 스냅샷을 쓰지 않으므로(R2-2) 입력한 요청사항이 남아
      있지 않다. 제출 상태로 돌려보내면 메모를 다시 쓸 수 있다.

      **`직접 만들기` 는 빼고 `조건 바꾸기` 하나만 남긴다.** 그 갈래는 `/plans/new`
      (새 일정)로 가는데, 여기서는 **일정이 이미 있고 하루만 실패했다** — 새 일정을
      만드는 것은 사용자가 하려던 일이 아니다.
    */
    return (
      <AiPlanFailed
        /*
          **`일정을 만들지 못했어요` 가 아니다.** 하루가 실패했을 뿐 일정은 그대로 있다 —
          없어지지 않은 것을 없어졌다고 말하면 확정 전에 사실을 말하는 이 화면의 원칙(R5)이
          실패 경로에서 뒤집힌다.
        */
        title={messages.plan.regenerateDayFailedTitle}
        errorMessage={job?.errorMessage ?? null}
        conditionSummary={null}
        onRetry={null}
        retrying={false}
        changeHref={submitHref}
        manualHref={null}
      />
    )
  }

  // ── 3. 진행 중 ─────────────────────────────────────────────────────────

  if (job === null || polling) {
    return (
      <AiPlanProgress
        status={job?.status ?? null}
        /*
          **세부 단계는 여기서도 그린다** (#250). 재생성도 같은 `ai-plans` 작업이라 계약이
          같고, 수십 초 기다리는 것도 같다.
        */
        step={job?.step ?? null}
        stepProgress={jobStepProgress(job)}
        phase={phase}
        onRecheck={recheck}
        rechecking={query.isFetching}
        /*
          **그만두기는 이 화면에 두지 않는다** (#250 범위 밖).

          취소 자체는 같은 API 로 되지만 **끝난 뒤 갈 곳이 다르다** — 새 일정 만들기는
          "같은 조건으로 다시" 가 답인 반면, 여기서는 일정과 그 날이 그대로 남아 있어
          제출 화면으로 되돌리는 것이 맞다. 그 갈래를 설계하지 않은 채 버튼만 달면
          취소한 사용자가 재생성 실패 화면을 보게 된다.
        */
        onCancel={null}
        canceling={false}
        cancelFailed={false}
      />
    )
  }

  // ── 4. 완료 ────────────────────────────────────────────────────────────

  if (nextItems === null || nextItems.length === 0) {
    /*
      **빈 배열로 되붙이지 않는다** (R4-2). 초안에 그 날이 없으면(LLM 이 빼먹었거나
      `COMPLETED` 인데 초안이 아예 없으면) 재생성 실패로 다루고 다시 제출하게 한다 —
      다시 조회해도 같은 초안이라 `ErrorState` 의 재시도는 답이 아니다.

      **빈 배열도 여기서 막는다.** `null`(그 날이 초안에 없다)과 뜻이 다르지만
      **되붙이면 결과가 같다** — `PlanDayItemsReplacePayload` 는 빈 목록을 "그 일자 전부
      삭제" 로 읽는다. 위 `PLAN_004` 제외(R6)가 그 날의 마지막 항목을 걸러내면 실제로
      여기 닿는다: 사용자는 안내대로 `이 날 바꾸기` 를 다시 누를 뿐인데 그 날이 비워진다.
      **버튼을 잠그는 것으로 대신하지 않는다** — 새는 지점이 하나뿐이어야 한다.
    */
    return (
      <EmptyState
        title={messages.plan.regenerateDayMissing}
        action={
          <ButtonLink href={submitHref} variant="secondary">
            {messages.plan.regenerateDaySubmit}
          </ButtonLink>
        }
      />
    )
  }

  const currentItems = groupItemsByDay(plan.items, plan.totalDays).days[day - 1]?.items ?? []

  return (
    <div className="px-4 pb-8 md:px-10">
      <PlanDayDiff current={toDiffRows(currentItems)} next={toNextDiffRows(nextItems)} />

      {/*
        경고 두 줄과 저장 실패 표시는 확정 블록이 갖는다 — 훅이 붙은 이 뷰 안에 두면
        node 환경 렌더 테스트가 닿지 않아 검증에서 빠진다.
      */}
      <PlanDayRegenerateConfirm
        onApply={() => void apply(nextItems)}
        /*
          **장소 조회가 끝날 때까지 함께 잠근다** (R6). `PLAN_004` 복구는
          `delistedPlaceIds` 를 근거로 하는데 그 조회가 아직 진행 중이면 집합이 비어
          있어, 눌러도 아무것도 빠지지 않고 같은 400 만 다시 받는다 — 화면은 그대로다.
        */
        applying={applying || placesLoading}
        error={saveError}
      />
    </div>
  )
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/** 저장된 항목 → 비교 행. 주소는 서버가 채워 준 장소 요약에서만 온다 (#86) */
export function toDiffRows(items: readonly PlanItemDetail[]): PlanDayDiffRow[] {
  return items.map((item) => ({
    title: item.title,
    caption: item.place?.addr1 ?? null,
  }))
}

/**
 * 새 초안 항목 → 비교 행.
 *
 * **주소를 지어내지 않는다.** 아직 보내지 않은 항목이라 장소 요약이 없다 — 메모가
 * 있으면 그것을 쓰고, 없으면 비운다.
 */
export function toNextDiffRows(items: readonly PlanItemRequest[]): PlanDayDiffRow[] {
  return items.map((item) => ({
    title: item.title,
    caption: item.memo ?? null,
  }))
}
