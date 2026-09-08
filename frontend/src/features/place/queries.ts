import type { PlaceFilters } from '@/types/place'

/**
 * 서버 프리페치와 클라이언트가 **같은 key** 를 써야 하이드레이션이 성립한다.
 * key 에는 파싱된 필터 객체를 넣는다 — URL 문자열을 넣으면 파라미터 순서만
 * 달라도 캐시가 갈린다 (docs/api-integration-guide.md §7).
 */
export const placeKeys = {
  all: ['places'] as const,
  list: (filters: PlaceFilters) => [...placeKeys.all, 'list', filters] as const,
  detail: (placeId: string) => [...placeKeys.all, 'detail', placeId] as const,
}

/**
 * 장소 데이터는 batch 로 적재되어 세션 중 거의 불변이다 — §7 표준값.
 *
 * **영업 상태(`intro.openNow`)가 붙었지만 5분을 그대로 둔다** (#294). 긴급 시설이
 * 1분으로 내린 것은(`use-nearby-facilities.ts`) "지금 당장 가야 하는" 화면이라서고,
 * 장소 상세는 계획 화면이다. `openNow` 하나 때문에 전체를 1분으로 내리면 사진·소개·
 * 적합도까지 5배 자주 재조회한다. 개·폐점 경계의 최대 5분 오차는 판정값 바로 아래
 * 운영시간 원문이 있어 사용자가 확인할 수 있다.
 */
export const PLACE_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
} as const

/**
 * 목록 조회 hook 은 client component 에서만 쓴다.
 * 서버 프리페치는 `app/(main)/places/page.tsx` 가 같은 key 로 수행한다
 * — key 가 다르면 프리페치가 버려진다 (architecture-guide.md §9).
 */
export const placeListQueryOptions = {
  ...PLACE_QUERY_OPTIONS,
  initialPageParam: null as string | null,
} as const
