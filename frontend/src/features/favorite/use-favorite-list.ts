'use client'

import { useQuery } from '@tanstack/react-query'

import { FAVORITE_QUERY_OPTIONS, favoriteKeys } from '@/features/favorite/queries'
import { fetchFavoriteList } from '@/lib/api/favorite'

/**
 * 저장한 장소 목록 — 아트보드 `혼디가개 저장한 장소` 01.
 *
 * **커서가 없다.** 회원당 100곳 상한이라 전량이 한 번에 온다 — `useInfiniteQuery` 가
 * 아니다 (명세 D3).
 *
 * **장소 상세와 같은 query key 를 쓴다** (`favoriteKeys.list()`). 여기서 해제하면
 * 상세로 돌아갔을 때 하단 바의 저장 상태가 이미 맞다 — 두 화면이 같은 캐시를 본다.
 *
 * `enabled` 를 두지 않는다. 이 화면은 보호 경로(`/favorites`)라 미로그인이 도달하지
 * 않는다 — `proxy.ts` 가 로그인으로 돌린다. 장소 상세(`use-place-favorite.ts`)가
 * `enabled: authed` 를 쓰는 것은 그쪽이 미로그인에게도 열려 있기 때문이다.
 */
export function useFavoriteList() {
  return useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: fetchFavoriteList,
    staleTime: FAVORITE_QUERY_OPTIONS.staleTime,
    gcTime: FAVORITE_QUERY_OPTIONS.gcTime,
  })
}
