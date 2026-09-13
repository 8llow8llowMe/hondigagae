'use client'

import { useInfiniteQuery } from '@tanstack/react-query'

import { placeKeys, placeListQueryOptions } from '@/features/place/queries'
import { clientFetch } from '@/lib/api/client'
import { nextPlaceCursor, placeListPath, type PlaceSlice } from '@/lib/api/place'
import type { PlaceFilters } from '@/types/place'

/**
 * @param enabled 조회를 켤지 (#431). **검색 전에는 끈다** — AI 피커의 검색 탭은 검색어를
 *   받기 전까지 보여 줄 것이 없는데, 켜 두면 탭을 여는 것만으로 전체 목록을 한 번 받는다.
 *   key 는 `placeKeys.list(filters)` 로 `/places` 와 **같으므로**, 같은 조건을 이미 받아
 *   뒀으면 요청이 아예 나가지 않는다.
 */
export function usePlaceList(filters: PlaceFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: placeKeys.list(filters),
    queryFn: ({ pageParam }) => clientFetch<PlaceSlice>(placeListPath(filters, pageParam)),
    initialPageParam: placeListQueryOptions.initialPageParam,
    getNextPageParam: (last: PlaceSlice) => nextPlaceCursor(last) ?? null,
    enabled,
    staleTime: placeListQueryOptions.staleTime,
    gcTime: placeListQueryOptions.gcTime,
  })
}
