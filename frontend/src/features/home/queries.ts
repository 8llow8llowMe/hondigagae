import { isRetriable } from '@/lib/api/error'

/**
 * 홈이 쓰는 조회 key 와 옵션.
 *
 * 서버 프리페치와 클라이언트가 **같은 key** 를 써야 하이드레이션이 성립한다
 * (docs/api-integration-guide.md §7).
 *
 * 반려견 목록은 `petKeys` 를 **그대로 공유한다** — 별도 key 를 만들면 `/pets` 에서 등록해도
 * 헤더 스위처가 낡는다 (전역nav-세부명세 D3).
 */
export const homeKeys = {
  all: ['home'] as const,
  /** 조건이 달라지면 다른 판정이므로 key 에 포함한다 — 반려견을 바꾸면 재조회된다 */
  walkSafety: (placeId: string, conditionKey: string) =>
    [...homeKeys.all, 'walk-safety', placeId, conditionKey] as const,
  suitability: (placeId: string, conditionKey: string) =>
    [...homeKeys.all, 'suitability', placeId, conditionKey] as const,
  planWeather: (planId: string) => [...homeKeys.all, 'plan-weather', planId] as const,
}

/**
 * **`staleTime` 5분은 §7 표에 없는 도메인이다** (홈-세부명세 D3).
 *
 * 장소 데이터(5분)와 같은 값이지만 **이유가 다르다** — 장소는 배치로 적재돼 잘 안 바뀌고,
 * 인사이트는 **기상 예보 단위가 1시간**이라 그보다 자주 다시 부르는 것이 낭비다.
 * `api-integration-guide.md` §7 표에 `장소 인사이트` 행을 추가했다.
 */
export const INSIGHT_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  /**
   * §7 의 "retry 1" 을 **오류 종류를 보존한 채** 구현한다.
   * 숫자 `retry: 1` 을 주면 전역 error-aware retry 를 덮어써 400·404 까지 재시도한다
   * (`PET_QUERY_OPTIONS` 와 같은 이유 — 이슈 #12 에서 실제로 겪었다).
   */
  retry: (failureCount: number, error: unknown) => isRetriable(error) && failureCount < 1,
} as const

/**
 * 조건을 key 조각으로 만든다.
 *
 * 반려견을 바꾸면 판정이 달라지므로 key 가 달라야 한다. `petId` 를 쓰지 않고 **조건 자체**를
 * 쓰는 이유는, 같은 조건의 다른 반려견이면 응답이 같아 캐시를 나눌 이유가 없기 때문이다.
 */
export function conditionKey(condition: { [key: string]: unknown } | null): string {
  if (condition === null) return 'none'

  return JSON.stringify(condition)
}
