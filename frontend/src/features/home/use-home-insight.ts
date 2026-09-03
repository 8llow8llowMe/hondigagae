'use client'

import { useQueries, useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import {
  regionalWeatherPath,
  suitabilityPath,
  walkSafetyPath,
  walkTimesPath,
} from '@/lib/api/insight'
import { conditionKey, INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import type {
  PetCondition,
  PlaceSuitabilityResponse,
  RegionalWeatherResponse,
  WalkSafetyResponse,
  WalkTimesResponse,
} from '@/types/insight'

/**
 * 기준 장소의 산책 판정.
 *
 * **`placeId` 가 null 이면 조회하지 않는다** — 첫 방문자에게는 기준이 없고, 그때는
 * 판정 섹션 자체를 렌더하지 않는다 (공통명세 S4-1).
 *
 * 반려견을 바꾸면 조건이 바뀌어 key 가 달라지고 재조회된다. `placeholderData` 로
 * **이전 값을 유지**해 스켈레톤으로 되돌아가지 않게 한다 (홈-세부명세 D4-2) —
 * 깜빡이면 "바꾼 게 반영됐나" 를 알 수 없다.
 */
export function useWalkSafety(placeId: string | null, condition: PetCondition | null) {
  return useQuery({
    queryKey: insightKeys.walkSafety(placeId ?? '', conditionKey(condition)),
    queryFn: () => clientFetch<WalkSafetyResponse>(walkSafetyPath(placeId as string, condition)),
    enabled: placeId !== null,
    placeholderData: (previous) => previous,
    ...INSIGHT_QUERY_OPTIONS,
  })
}

/**
 * 오늘의 산책 골든타임 (#158).
 *
 * **`useWalkSafety` 와 달리 항상 조회한다.** 저쪽은 기준 장소가 있어야 성립하지만 이쪽은
 * 좌표만 있으면 되고, 좌표는 호출부가 제주 기준으로 늘 갖고 있다 — 첫 방문자에게도
 * "오늘 언제 나가면 좋은지" 는 답할 수 있다.
 *
 * 반려견을 바꾸면 조건 key 가 갈려 재조회되고, `placeholderData` 로 이전 곡선을 유지한다 —
 * 깜빡이면 바꾼 것이 반영됐는지 알 수 없다 (홈-세부명세 D4-2).
 */
export function useWalkTimes(lat: number, lng: number, condition: PetCondition | null) {
  return useQuery({
    queryKey: insightKeys.walkTimes(lat, lng, conditionKey(condition)),
    queryFn: () => clientFetch<WalkTimesResponse>(walkTimesPath(lat, lng, condition)),
    placeholderData: (previous) => previous,
    ...INSIGHT_QUERY_OPTIONS,
  })
}

/**
 * 제주 권역 날씨 비교 (#158).
 *
 * 골든타임과 같은 성격이라 같은 규칙을 쓴다 — 조건 없이도 조회하고, 반려견을 바꾸면
 * 재조회하되 이전 표를 유지한다.
 */
export function useRegionalWeather(condition: PetCondition | null) {
  return useQuery({
    queryKey: insightKeys.regionalWeather(conditionKey(condition)),
    queryFn: () => clientFetch<RegionalWeatherResponse>(regionalWeatherPath(condition)),
    placeholderData: (previous) => previous,
    ...INSIGHT_QUERY_OPTIONS,
  })
}

/**
 * 상위 N개 장소의 적합도를 **병렬로** 조회한다 (홈-세부명세 D3).
 *
 * 순차로 하면 3배 느리다. **하나가 실패하면 그 카드만 빠진다** — 나머지는 렌더한다.
 * 목록 단위 적합도 API 가 생기면(S6-2) 이 훅만 바꾼다.
 */
export function useSuitabilities(placeIds: string[], condition: PetCondition | null) {
  return useQueries({
    queries: placeIds.map((placeId) => ({
      queryKey: insightKeys.suitability(placeId, conditionKey(condition)),
      queryFn: () => clientFetch<PlaceSuitabilityResponse>(suitabilityPath(placeId, condition)),
      placeholderData: (previous: PlaceSuitabilityResponse | undefined) => previous,
      ...INSIGHT_QUERY_OPTIONS,
    })),
  })
}
