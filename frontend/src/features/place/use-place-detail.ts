'use client'

import { useQuery } from '@tanstack/react-query'

import { PLACE_QUERY_OPTIONS, placeKeys } from '@/features/place/queries'
import { clientFetch } from '@/lib/api/client'
import { placeDetailPath } from '@/lib/api/place'
import { isPlaceId } from '@/lib/place/place-id'
import type { PlaceDetail } from '@/types/place'

/**
 * 상세 조회 hook 은 client component 에서만 쓴다.
 * 서버 프리페치는 `app/(main)/places/[placeId]/page.tsx` 가 **같은 key** 로 수행한다
 * — key 가 다르면 프리페치가 버려진다 (architecture-guide.md §9).
 */
export function usePlaceDetail(placeId: string) {
  /*
    **형식이 틀린 `placeId` 면 켜지 않는다** (#496). 컨트롤러가 `@PathVariable long` 이라
    답이 400 으로 정해져 있다. 라우트가 이미 그런 주소를 가르지만, **이 훅이 다른 곳에서도
    불릴 수 있어** 여기서도 잠근다 — 가드가 한쪽에만 있으면 새 진입로가 조용히 400 을 낸다.
  */
  const enabled = isPlaceId(placeId)

  return useQuery({
    queryKey: placeKeys.detail(placeId),
    queryFn: () => clientFetch<PlaceDetail>(placeDetailPath(placeId)),
    staleTime: PLACE_QUERY_OPTIONS.staleTime,
    gcTime: PLACE_QUERY_OPTIONS.gcTime,
    enabled,
  })
}
