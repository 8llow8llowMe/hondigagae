'use client'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { usePetList } from '@/features/pet/use-pet-list'
import { PlanDetailSection } from '@/features/plan/plan-detail-section'
import { usePlaceEnrichment, usePlanDetail, usePlanWeather } from '@/features/plan/use-plan-detail'
import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { enrichTargetIds } from '@/lib/plan/detail'

/**
 * 일정 상세 — 조회 3종을 묶는 껍데기.
 *
 * **오류를 한 덩어리로 다루지 않는다** (D5).
 *  - 일정 본문 5xx → 화면 전체 `ErrorState`
 *  - 판정 5xx → **일자 섹션 안에만** 인라인 (아트보드 06 ③)
 *  - 반려견 조회 실패 → 카드만 빠진다
 *  - 항목 장소 조회 실패 → 제목만 남고 행은 유지된다
 *
 * 404 는 여기 오지 않는다 — `page.tsx` 가 `notFound()` 로 보낸다.
 */
export function PlanDetailView({ planId, today }: { planId: string; today: string }) {
  const detail = usePlanDetail(planId)
  const weather = usePlanWeather(planId)
  const pets = usePetList()

  const items = detail.data?.items ?? []
  const { places, missing } = usePlaceEnrichment(enrichTargetIds(items))

  if (detail.isPending) return null

  if (detail.isError) {
    /*
      **400 에는 재시도를 주지 않는다.** 숫자가 아닌 `planId` 는 404 가 아니라
      400 `PLAN_114` 이고(`@PathVariable long`), 같은 주소를 다시 불러도 같은 400 이다.
      `ErrorState` 는 재시도가 필수 prop 이라 중립 톤 `EmptyState` 를 쓴다 (D5).
    */
    if (detail.error instanceof ApiError && detail.error.status === 400) {
      return (
        <EmptyState
          title={messages.plan.detailBadRequestTitle}
          description={messages.plan.detailBadRequestDescription}
          action={
            <ButtonLink href="/plans" variant="secondary">
              {messages.plan.backToList}
            </ButtonLink>
          }
        />
      )
    }

    return (
      <ErrorState
        title={messages.plan.detailErrorTitle}
        description={messages.plan.errorDescription}
        onRetry={() => void detail.refetch()}
      />
    )
  }

  if (detail.data === undefined) return null

  // 이 일정의 반려견만 찾는다. 조회 실패·삭제된 반려견이면 null 이고 카드만 빠진다
  const pet = pets.data?.pets.find((candidate) => candidate.petId === detail.data.petId) ?? null

  return (
    <PlanDetailSection
      plan={detail.data}
      pet={pet}
      petPending={pets.isPending}
      places={places}
      missingPlaces={missing}
      weather={weather.data}
      weatherFailed={weather.isError}
      onRetryWeather={() => void weather.refetch()}
      today={new Date(today)}
    />
  )
}
