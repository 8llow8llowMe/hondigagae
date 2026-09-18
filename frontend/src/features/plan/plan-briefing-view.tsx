'use client'

import { useQuery } from '@tanstack/react-query'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { Surface } from '@/components/surface'
import { usePetList } from '@/features/pet/use-pet-list'
import { PlanBriefingHeader, PlanBriefingSection } from '@/features/plan/plan-briefing-section'
import { planKeys } from '@/features/plan/queries'
import { clientFetch } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { toPetCondition, walkTimesPath } from '@/lib/api/insight'
import { fetchPlanBriefing } from '@/lib/api/plan'
import { weekdayOf } from '@/lib/date/day'
import { conditionKey, INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import { messages } from '@/lib/messages'
import { basisPetNameOf } from '@/lib/plan/basis-pet'
import type { BriefingTarget } from '@/lib/plan/briefing'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { WalkTimesResponse } from '@/types/insight'
import type { PlanBriefingResponse } from '@/types/plan'

/**
 * 출발 전 여행 브리핑 화면 (#626) — 조회를 든 쪽.
 *
 * **서버에서 프리페치하지 않는다.** 응답 하나가 auth 특성 1 + tour 적합도 최대 5 + 장소
 * 요약 1 + 특보 1 + 골든타임 1 의 원격 호출을 묶는다(`PlanBriefingProcessor` 머리주석) —
 * 서버 렌더가 그만큼 붙잡힌다. **응급 브리핑이 같은 이유로 자기 응답을 프리페치하지 않는다.**
 * 404 가드에 필요한 것은 일정 상세뿐이고 그것은 페이지가 이미 데웠다.
 *
 * **머리까지 이 뷰가 그린다.** 부제(`{제목} · {N}일차 …`)가 응답에서 오는데 `h1` 과 한
 * 덩어리라, 페이지(서버)가 머리를 그리면 부제가 다른 스택 자식으로 떨어져 사이에 카드
 * 간격(24)이 생긴다 (`plan-emergency-view.tsx` 와 같은 처리).
 */
export function PlanBriefingView({ planId, target }: { planId: string; target: BriefingTarget }) {
  const briefing = useQuery({
    queryKey: planKeys.briefing(planId, target.date),
    queryFn: () => fetchPlanBriefing(planId, target.date),
    // 내용이 예보 판정이라 일정(30초)이 아니라 인사이트(5분)다 (`queries.ts` 주석)
    ...INSIGHT_QUERY_OPTIONS,
  })

  // `/plans` 는 `proxy.ts` PROTECTED_PATHS 라 미로그인이 여기 닿지 않는다
  const pets = usePetList(true)

  const data = briefing.data
  const walkTimes = data?.walkTimes ?? null

  /*
    **판정 기준 반려견의 조건으로 곡선을 부른다.** 못 찾으면 `null` 을 보낸다 — 서버가
    일반 조건으로 판정하고, 그 사실은 브리핑 응답의 `petConditionApplied` 가 말한다.
  */
  const basisPet = pets.data?.pets.find((pet) => pet.petId === data?.basisPetId) ?? null
  const condition = toPetCondition(basisPet)

  /*
    **곡선은 좌표가 있을 때만 부른다** (명세 D3-3). 좌표는 `walkTimes` 안에만 오므로
    `walkTimes === null` 이면 부를 대상이 아예 없다 — 일정 상세의 `item.place.lat/lng` 로
    메우지 않는다 (명세 D8-1).

    **key 는 홈·장소 상세와 같은 `insightKeys.walkTimes` 다** — 좌표·조건이 같으면 이미
    받아 둔 곡선을 그대로 쓴다.
  */
  const curve = useQuery({
    queryKey: insightKeys.walkTimes(
      walkTimes?.lat ?? null,
      walkTimes?.lng ?? null,
      conditionKey(condition),
    ),
    // `enabled` 가 거짓인 동안 실행되지 않는다 — 좌표 단언은 그 뒤에만 닿는다
    queryFn: () =>
      clientFetch<WalkTimesResponse>(
        walkTimesPath(
          (walkTimes as { lat: number; lng: number }).lat,
          (walkTimes as { lat: number; lng: number }).lng,
          condition,
        ),
      ),
    enabled: walkTimes !== null,
    ...INSIGHT_QUERY_OPTIONS,
  })

  return (
    <>
      <PlanBriefingHeader planId={planId} subtitle={subtitleOf(data)} />

      {briefing.isPending ? (
        <Surface aria-label={messages.plan.briefingHeading} aria-busy>
          <PlanBriefingSkeleton />
        </Surface>
      ) : briefing.isError || data === undefined ? (
        <Surface aria-label={messages.plan.briefingHeading}>
          <BriefingError
            planId={planId}
            error={briefing.error}
            onRetry={() => void briefing.refetch()}
          />
        </Surface>
      ) : (
        <PlanBriefingSection
          briefing={data}
          basisPetName={basisPetNameOf(
            data.basisPetId,
            data.petIds,
            new Map((pets.data?.pets ?? []).map((pet) => [pet.petId, pet.name])),
          )}
          curve={{
            hourly: curve.data?.hourly ?? null,
            failed: curve.isError,
            onRetry: () => void curve.refetch(),
          }}
        />
      )}
    </>
  )
}

/**
 * `{제목} · {N}일차 09-13 (일)` — **응답의 값으로 만든다.**
 *
 * 화면이 고른 날짜를 쓰지 않는다. 서버는 자기 `Clock` 을 보므로 자정 전후에 FE 가 고른
 * 날짜와 응답의 `date`·`day` 가 갈릴 수 있다 (`lib/plan/briefing.ts` 주석).
 */
function subtitleOf(data: PlanBriefingResponse | undefined): string | null {
  if (data === undefined) return null

  const weekday = weekdayOf(data.date)
  const line = messages.plan.briefingSubtitle
    .replace('{title}', data.planTitle)
    .replace('{day}', String(data.day))
    .replace('{date}', data.date.slice(5))

  // 요일을 못 읽으면 괄호를 비워 두지 않는다 — 빈 `()` 는 고장으로 읽힌다
  return weekday === null ? line.replace(' ({weekday})', '') : line.replace('{weekday}', weekday)
}

/**
 * 조회 실패 갈래.
 *
 * **400(`PLAN_002`)에 재시도를 다는 것은 이 자리 한정이다.** 화면이 기간 안의 날짜만
 * 보내므로 이 코드는 "그 사이 기간이 수정됐다" 는 뜻이고 다시 열면 풀린다 — 입력 폼이
 * 아니라 고칠 필드가 없어 `일정 보기` 를 함께 준다 (명세 D5-0).
 *
 * `resultMessage` 는 백엔드 타입이 `Object` 라 `unknown` 으로 받고 렌더 직전 정규화한다 —
 * `ApiError.message` 가 그 일을 이미 한다.
 */
function BriefingError({
  planId,
  error,
  onRetry,
}: {
  planId: string
  error: unknown
  onRetry: () => void
}) {
  const badRequest = error instanceof ApiError && error.status === 400

  return (
    <>
      <ErrorState
        title={badRequest ? error.message : messages.plan.briefingErrorTitle}
        description={badRequest ? messages.plan.briefingStaleRangeDescription : undefined}
        onRetry={onRetry}
        inset="card"
      />

      {/* `ErrorState` 에는 액션 슬롯이 없다 — 링크는 아래 형제로 둔다 (400 에서만) */}
      {badRequest && (
        <div className={cn('pb-6', INSET_CLASS.card)}>
          <ButtonLink href={`/plans/${planId}`} variant="secondary">
            {messages.plan.briefingOutOfRangeAction}
          </ButtonLink>
        </div>
      )}
    </>
  )
}

function PlanBriefingSkeleton() {
  return (
    <div aria-hidden className={cn('flex flex-col gap-3 py-4', INSET_CLASS.card)}>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

/**
 * 기간 밖 — **요청을 아예 하지 않는다** (`pickBriefingDate` 가 `null`).
 *
 * 데이터 부재라 `EmptyState` 고 **재시도가 없다**. 출발 이틀 전에 직접 URL 로 오면 여기다.
 */
export function PlanBriefingOutOfRange({ planId }: { planId: string }) {
  return (
    <>
      <PlanBriefingHeader planId={planId} subtitle={null} />

      <Surface aria-label={messages.plan.briefingHeading}>
        <EmptyState
          title={messages.plan.briefingOutOfRangeTitle}
          description={messages.plan.briefingOutOfRangeDescription}
          inset="card"
          action={
            <ButtonLink href={`/plans/${planId}`} variant="secondary">
              {messages.plan.briefingOutOfRangeAction}
            </ButtonLink>
          }
        />
      </Surface>
    </>
  )
}
