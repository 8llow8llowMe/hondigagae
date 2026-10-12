'use client'

import { useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { recommendationsPath, regionalWeatherPath, walkSafetyPath } from '@/lib/api/insight'
import { conditionKey, INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import type {
  PetCondition,
  PlaceRecommendationResponse,
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
 * 홈 `오늘 갈 만한 곳` — 장소 추천 **한 번**이다 (#1380 · 홈-세부명세 D10-1).
 *
 * 예전에는 목록 앞 N곳(`GET /places`)을 서버가 받아 두고 그 N곳의 적합도를 하나씩 불렀다
 * (`useSuitabilities`, N+1). 그래서 추천이 "장소 ID 앞 3곳" 이었고 동반 미확인 장소가 섰다
 * (`docs/ux-review-2026-10-11.md` §3-2). 추천 API 가 후보 전부를 같은 적합도 규칙으로 재고 동반
 * 미확인을 거른다.
 *
 * **서버 프리페치하지 않는다.** 캐시 미스 콜드 응답이 dev 실측 18초다(BE 캐시 600초) — 서버에서
 * 기다리면 첫 HTML 이 통째로 막힌다. 클라이언트가 받고 그동안 골격(`SuitabilityListSkeleton`)이
 * 선다. 반려견 조건도 클라이언트 스토어에서 정해져 서버는 key 를 모른다(판정과 같은 이유).
 *
 * 반려견을 바꾸면 조건이 바뀌어 key 가 달라진다. `placeholderData` 로 **이전 카드를 유지**한다
 * (D4-2) — 판정 · 권역과 같은 규칙이고, 표준값은 장소 인사이트 행(`INSIGHT_QUERY_OPTIONS`)이다.
 *
 * **`enabled` — 조건이 정해진 뒤에만 부른다** (#1380 검토). 로그인 사용자는 반려견 목록 · 고른 반려견
 * 복원이 끝나야 조건이 선다. 그 전에 부르면 조건 없는 추천을 한 번 받고 조건이 서는 순간 다른 key 로 또
 * 부른다 — 콜드 18초짜리 계산 하나가 버려지고, BE 문서 §6-5 가 경고한 기상청 호출 경로를 한 번 더 탄다.
 * 적합도 단건은 가벼워 그 비용을 받아들였지만 추천은 다르다.
 */
export function useRecommendations(
  condition: PetCondition | null,
  limit: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: insightKeys.recommendations(conditionKey(condition), limit),
    queryFn: () => clientFetch<PlaceRecommendationResponse>(recommendationsPath(condition, limit)),
    placeholderData: (previous) => previous,
    enabled,
    ...INSIGHT_QUERY_OPTIONS,
  })
}
