'use client'

import { useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { facilitiesPath, MAX_SIZE } from '@/lib/api/emergency'
import { isRetriable } from '@/lib/api/error'
import type { NearbyFacilityResult } from '@/types/emergency'

/**
 * 주변 긴급 시설 조회.
 *
 * **`staleTime` 이 짧다(1분).** 시설 목록 자체는 배치로 적재돼 잘 안 바뀌지만
 * `openNow` 가 **시각에 따라 바뀌는 값**이다 — 장소(5분)와 같은 값을 쓰면 문 닫은
 * 병원을 "진료중" 으로 보여줄 수 있다. 급할 때 여는 화면이라 그 오차가 비싸다.
 *
 * **`enabled` 로 좌표를 기다린다.** `lat`/`lng` 가 필수라 좌표 없이 부르면 400 이다.
 */
export const emergencyKeys = {
  all: ['emergency'] as const,
  facilities: (lat: number, lng: number, radius: number) =>
    [...emergencyKeys.all, 'facilities', lat, lng, radius] as const,
}

export const EMERGENCY_QUERY_OPTIONS = {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  /** 오류 종류를 보존한 채 1회 재시도 — 숫자 retry 는 400·404 까지 재시도한다 */
  retry: (failureCount: number, error: unknown) => isRetriable(error) && failureCount < 1,
} as const

export function useNearbyFacilities(position: { lat: number; lng: number } | null, radius: number) {
  return useQuery({
    queryKey: emergencyKeys.facilities(position?.lat ?? 0, position?.lng ?? 0, radius),
    queryFn: () =>
      clientFetch<NearbyFacilityResult>(
        facilitiesPath({
          lat: position?.lat as number,
          lng: position?.lng as number,
          radius,
          size: MAX_SIZE,
        }),
      ),
    enabled: position !== null,
    // 반경을 넓히는 동안 스켈레톤으로 되돌아가지 않게 한다 — 목록이 사라지면
    // 넓힌 것이 반영됐는지 알 수 없다
    placeholderData: (previous) => previous,
    ...EMERGENCY_QUERY_OPTIONS,
  })
}
