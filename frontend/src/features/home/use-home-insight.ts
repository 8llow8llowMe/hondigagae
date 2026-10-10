'use client'

import { useQueries, useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { regionalWeatherPath, suitabilityPath, walkSafetyPath } from '@/lib/api/insight'
import { conditionKey, INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import type {
  PetCondition,
  PlaceSuitabilityResponse,
  RegionalWeatherResponse,
  WalkSafetyResponse,
} from '@/types/insight'

/**
 * 기준 장소의 산책 판정.
 *
 * **`placeId` 가 null 이면 조회하지 않는다.** 첫 방문자에게 고른 기준은 없지만 그때는
 * **대표 지점으로 떨어진다** (#636 · 홈-첫방문-판정-세부명세 D3-1) — 판정 섹션이 선다.
 * 여기가 `null` 인 것은 그 대표 지점마저 404 인 경우뿐이고, 그때만 섹션을 렌더하지
 * 않는다 (D5-3). **그래서 `enabled` 를 지우지 않는다.**
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
