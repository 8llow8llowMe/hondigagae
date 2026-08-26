'use client'

import { useInfiniteQuery } from '@tanstack/react-query'

import { placeKeys, placeListQueryOptions } from '@/features/place/queries'
import { clientFetch } from '@/lib/api/client'
import { nextPlaceCursor, placeListPath, type PlaceSlice } from '@/lib/api/place'
import type { PlaceFilters } from '@/types/place'

export function usePlaceList(filters: PlaceFilters) {
  return useInfiniteQuery({
    queryKey: placeKeys.list(filters),
    queryFn: ({ pageParam }) => clientFetch<PlaceSlice>(placeListPath(filters, pageParam)),
    initialPageParam: placeListQueryOptions.initialPageParam,
    getNextPageParam: (last: PlaceSlice) => nextPlaceCursor(last) ?? null,
    staleTime: placeListQueryOptions.staleTime,
    gcTime: placeListQueryOptions.gcTime,
  })
}
