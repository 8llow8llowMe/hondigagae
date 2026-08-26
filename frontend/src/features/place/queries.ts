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

/** 장소 데이터는 batch 로 적재되어 세션 중 거의 불변이다 — §7 표준값 */
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
