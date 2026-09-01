'use client'

import { useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { isRetriable } from '@/lib/api/error'
import { nearbyPlacesPath } from '@/lib/api/place'
import type { LatLng } from '@/lib/geo/coord'
import type { NearbyPlaceResult, PlaceFilters } from '@/types/place'

/**
 * 지도 영역 기준 주변 장소.
 *
 * **목록(`GET /places`)과 다른 조회다.** 목록은 지역·커서 기반이고 이쪽은 중심 + 반경이다.
 * 지도 기본 화면은 목록 캐시를 재사용하고(architecture-guide.md §9 "지도 뷰: 별도 조회
 * 금지"), 사용자가 **지도를 옮겼을 때만** 이 조회가 켜진다 — 그때는 목록 캐시가 화면
 * 밖을 말하고 있어 재사용이 오히려 틀리기 때문이다.
 *
 * 좌표를 query key 에 그대로 넣으면 1m 만 움직여도 캐시가 갈린다. 호출부가
 * `isSameViewport()` 로 걸러 **의미 있게 움직였을 때만** 새 center 를 넘긴다.
 */
export const nearbyKeys = {
  all: ['places', 'nearby'] as const,
  search: (center: LatLng, radius: number, filters: PlaceFilters) =>
    [...nearbyKeys.all, center.lat, center.lng, radius, filters] as const,
}

export function useNearbyPlaces(
  center: LatLng | null,
  radius: number,
  filters: PlaceFilters,
  enabled: boolean,
) {
  return useQuery({
    queryKey: nearbyKeys.search(center ?? { lat: 0, lng: 0 }, radius, filters),
    queryFn: () =>
      clientFetch<NearbyPlaceResult>(nearbyPlacesPath(center as LatLng, radius, filters)),
    enabled: enabled && center !== null,
    // 장소는 batch 적재라 세션 중 거의 불변 — §7 표준값(5분)을 따른다
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: (failureCount: number, error: unknown) => isRetriable(error) && failureCount < 1,
    // 지도를 옮기는 동안 마커가 사라졌다 나타나면 화면이 깜빡인다
    placeholderData: (previous) => previous,
  })
}
