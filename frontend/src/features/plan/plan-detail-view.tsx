'use client'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { usePetList } from '@/features/pet/use-pet-list'
import { PlanDetailSection } from '@/features/plan/plan-detail-section'
import { useAnchorScroll } from '@/features/plan/use-anchor-scroll'
import { usePlaceEnrichment, usePlanDetail, usePlanWeather } from '@/features/plan/use-plan-detail'
import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { alternativePlaceIds } from '@/lib/plan/detail'

/**
 * 일정 상세 — 조회 3종을 묶는 껍데기.
 *
 * **오류를 한 덩어리로 다루지 않는다** (D5).
 *  - 일정 본문 5xx → 화면 전체 `ErrorState`
 *  - 판정 5xx → **일자 섹션 안에만** 인라인 (아트보드 06 ③)
 *  - 반려견 조회 실패 → 카드만 빠진다
 *  - 항목의 `place` 가 비어 옴 → 주소 없이 제목만 남고 행은 유지된다 (#86·#115)
 *
 * 404 는 여기 오지 않는다 — `page.tsx` 가 `notFound()` 로 보낸다.
 */
export function PlanDetailView({ planId, today }: { planId: string; today: string }) {
  const detail = usePlanDetail(planId)
  const weather = usePlanWeather(planId)
  const pets = usePetList(true)
  // `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200)

  /*
    **보강은 실내 대안만 남았다** (#115). 항목은 상세 응답이 `place` 요약을 함께 주지만
    (#86) `indoorAlternatives` 는 `{placeId, title, lat, lng, distanceMeters}` 뿐이라
    주소를 말하려면 여전히 `GET /places/{id}` 가 필요하다. 판정이 늦게 오면 목록이
    늘어나고 그때 새 id 만 요청이 나간다.
  */
  const alternatives = weather.data?.days.flatMap((day) => day.indoorAlternatives) ?? []
  const { places, pending: enriching } = usePlaceEnrichment(alternativePlaceIds(alternatives))

  /*
    **세 조회가 모두 앉은 뒤** 해시 앵커로 다시 맞춘다. 늦게 도착하는 것이 전부 앵커 위
    콘텐츠를 키우기 때문이다 — 보강은 실내 대안 행마다 주소 줄을 더하고, **판정은
    일자마다 브리핑 블록을 통째로 더한다.** (항목의 주소·거리 줄은 #115 이후 상세
    응답과 함께 오므로 더 이상 늦게 자라지 않는다.)

    **`weather.isFetching` 까지 봐야 한다.** 담기 성공은 판정을 invalidate 하므로
    (항목이 늘면 그날 기준 장소가 바뀐다) 돌아온 직후 판정이 다시 날아온다. 보강만 보고
    맞추면 판정이 늦게 도착하며 `#day3` 이 다시 밀린다 — 실측에서 938px 로 뷰포트를
    벗어났다.
  */
  useAnchorScroll(!detail.isPending && !weather.isFetching && !enriching)

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
      pets={pets.data?.pets ?? []}
      petPending={pets.isPending}
      places={places}
      weather={weather.data}
      weatherFailed={weather.isError}
      onRetryWeather={() => void weather.refetch()}
      today={new Date(today)}
    />
  )
}
