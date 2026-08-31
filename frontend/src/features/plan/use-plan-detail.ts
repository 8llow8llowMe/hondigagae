'use client'

import { useQueries, useQuery } from '@tanstack/react-query'

import { PLACE_QUERY_OPTIONS, placeKeys } from '@/features/place/queries'
import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { clientFetch } from '@/lib/api/client'
import { placeDetailPath } from '@/lib/api/place'
import { fetchPlanDetail, fetchPlanWeather } from '@/lib/api/plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 일정 상세 조회. 서버 프리페치가 심어 둔 캐시를 **같은 key** 로 이어받는다 —
 * key 가 다르면 프리페치가 버려진다 (architecture-guide.md §9).
 */
export function usePlanDetail(planId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: planKeys.detail(planId),
    queryFn: () => fetchPlanDetail(planId),
    /*
      **아직 고르지 않은 일정을 조회하지 않기 위한 스위치다** (#118). 장소 상세의 담기
      시트는 일정을 고른 뒤에야 그 상세가 필요한데, 훅은 조건부로 부를 수 없다.
      기본값은 켜짐이라 기존 호출부는 그대로다.
    */
    enabled: options?.enabled ?? true,
    staleTime: PLAN_QUERY_OPTIONS.staleTime,
    gcTime: PLAN_QUERY_OPTIONS.gcTime,
  })
}

/**
 * 일자별 판정. **상세와 별도 query 다** — 판정만 실패해도 일정 본문은 살아 있어야 하고
 * (아트보드 06 ③) 그 섹션만 따로 재시도할 수 있어야 한다.
 */
export function usePlanWeather(planId: string) {
  return useQuery({
    queryKey: planKeys.weather(planId),
    queryFn: () => fetchPlanWeather(planId),
    staleTime: PLAN_QUERY_OPTIONS.staleTime,
    gcTime: PLAN_QUERY_OPTIONS.gcTime,
  })
}

/**
 * 장소 보강 — 장소당 `GET /places/{placeId}`.
 *
 * **실내 대안 전용이다** (#115). 일정 항목은 상세 응답이 `place` 요약을 함께 주므로
 * (#86) 더 이상 여기 들어오지 않는다 — 3일·6항목이면 왕복 6번이던 것이 0번이 됐다.
 * 남은 것은 `indoorAlternatives` 뿐인데, 그쪽은 `{placeId, title, lat, lng,
 * distanceMeters}` 라 주소·실내 여부를 말하려면 여전히 조회가 필요하다.
 *
 * **key 를 `placeKeys.detail` 로 재사용한다** — 장소 상세 화면과 캐시를 공유해서,
 * 상세를 보고 온 장소는 요청이 아예 나가지 않고 여기서 본 장소는 상세로 이동할 때
 * 즉시 뜬다.
 *
 * **실패한 장소는 결과 맵에서 빠질 뿐 행은 살아남는다** — 일정 자료는 우리 DB 이고
 * 장소는 다른 서비스다 (공통명세 S8).
 */
export function usePlaceEnrichment(placeIds: string[]): {
  places: Map<string, PlaceDetail>
  pending: boolean
} {
  const queries = useQueries({
    queries: placeIds.map((placeId) => ({
      queryKey: placeKeys.detail(placeId),
      queryFn: () => clientFetch<PlaceDetail>(placeDetailPath(placeId)),
      staleTime: PLACE_QUERY_OPTIONS.staleTime,
      gcTime: PLACE_QUERY_OPTIONS.gcTime,
    })),
  })

  const places = new Map<string, PlaceDetail>()
  for (const query of queries) {
    if (query.data !== undefined) places.set(query.data.placeId, query.data)
  }

  return { places, pending: queries.some((query) => query.isPending) }
}
