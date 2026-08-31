/**
 * 즐겨찾기 query key.
 *
 * **목록 하나뿐이다.** 백엔드에 단건 조회(`GET /favorites/places/{placeId}`)가 없어
 * "이 장소가 저장돼 있나" 도 목록에서 찾는다 — 상한이 100곳이라 전량이 가볍다.
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
