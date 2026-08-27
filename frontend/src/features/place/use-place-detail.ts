'use client'

import { useQuery } from '@tanstack/react-query'

import { PLACE_QUERY_OPTIONS, placeKeys } from '@/features/place/queries'
import { clientFetch } from '@/lib/api/client'
import { placeDetailPath } from '@/lib/api/place'
import type { PlaceDetail } from '@/types/place'

/**
 * 상세 조회 hook 은 client component 에서만 쓴다.
 * 서버 프리페치는 `app/(main)/places/[placeId]/page.tsx` 가 **같은 key** 로 수행한다
 * — key 가 다르면 프리페치가 버려진다 (architecture-guide.md §9).
 */
export function usePlaceDetail(placeId: string) {
  return useQuery({
    queryKey: placeKeys.detail(placeId),
    queryFn: () => clientFetch<PlaceDetail>(placeDetailPath(placeId)),
    staleTime: PLACE_QUERY_OPTIONS.staleTime,
    gcTime: PLACE_QUERY_OPTIONS.gcTime,
  })
}
