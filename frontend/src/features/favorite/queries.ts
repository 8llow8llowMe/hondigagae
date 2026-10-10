/**
 * 즐겨찾기 query key.
 *
 * **목록 하나뿐이다.** 저장한 장소 화면(#127)과 장소 상세의 하단 바가 **같은 키를 본다** —
 * 한쪽에서 해제하면 다른 쪽 상태가 바로 맞는다. 상한이 100곳이라 전량이 가볍다.
 *
 * 백엔드에 단건 조회(`GET /favorites/places/{placeId}`)가 **생겼다** (`4a4f2cd`,
 * `{placeId, favorited}`). 아직 쓰지 않는다 — 쓰려면 상세용 키를 따로 만들어야 하고,
 * 그러면 목록에서 해제했을 때 상세의 캐시가 따라오지 않아 무효화를 두 곳에 걸어야 한다.
 * 100곳 목록이 그 복잡도보다 싸다. 상한이 커지면 다시 본다.
 */
export const favoriteKeys = {
  all: ['favorites'] as const,
  list: () => [...favoriteKeys.all, 'list'] as const,
}

/**
 * api-integration-guide.md §7 표준값 — mutation 이 빈번한 목록이라 일정과 같은 30초 / 10분.
 *
 * 저장·해제 응답에 본문이 없어 **무효화가 유일한 갱신 수단이다.** staleTime 을 길게 두면
 * 토글 직후 아이콘이 옛 상태로 되돌아 보인다.
 */
export const FAVORITE_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 10 * 60_000,
} as const
