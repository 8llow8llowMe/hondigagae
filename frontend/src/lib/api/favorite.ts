import { clientFetch, clientFetchVoid } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type { FavoritePlaceList } from '@/types/favorite'

/**
 * 장소 즐겨찾기 API — 경로와 브라우저 호출부.
 *
 * 서버 컴포넌트는 이 파일의 `*Path()` 만 쓰고 전송은 server.ts 가 한다
 * (docs/architecture-guide.md §8). 아래 호출 함수는 브라우저 전용이다.
 */

export function favoriteListPath(): string {
  return paths.favorites.places
}

export function favoritePlacePath(placeId: string): string {
  return paths.favorites.place(placeId)
}

/**
 * 저장 상한. 백엔드 `FavoriteCommandProcessor.MAX_FAVORITE_COUNT` 의 복제본이다.
 *
 * 초과하면 서버가 `FAVORITE_002`(**400**, 409 가 아니다) 를 준다. 반려견 상한(#83)과 달리
 * **화면이 미리 막지 않는다** — 장소 상세는 즐겨찾기 목록을 이미 갖고 있지 않아,
 * 상한을 미리 알려면 저장 버튼 하나 때문에 목록 전량을 받아야 한다. 서버 오류를
 * 그대로 안내하는 쪽이 싸다.
 */
export const MAX_FAVORITE_COUNT = 100

/** `FAVORITE_002` — 필드 검증 400 과 같은 상태코드라 resultCode 로 구분해야 한다 */
export const FAVORITE_LIMIT_EXCEEDED_CODE = 'FAVORITE_002'

/** `FAVORITE_001` — 노출 불가(병합·delisted) 장소다. 재시도로 풀리지 않는다 */
export const FAVORITE_MISSING_PLACE_CODE = 'FAVORITE_001'

export function fetchFavoriteList(): Promise<FavoritePlaceList> {
  return clientFetch<FavoritePlaceList>(favoriteListPath())
}

/**
 * 저장. **멱등이다** — 이미 저장된 장소를 다시 저장해도 성공한다
 * (`FavoriteCommandProcessor.add`). 토글 연타가 오류로 튀지 않는다.
 *
 * `dataBody` 가 없는 `Response<Void>` 라 `unwrapVoid` 경로를 쓴다 — **저장 후 상태를
 * 응답에서 읽을 수 없다.** 호출부가 목록을 무효화해서 안다.
 */
export function addFavorite(placeId: string): Promise<void> {
  return clientFetchVoid(favoritePlacePath(placeId), { method: 'POST' })
}

/** 해제. 저장과 마찬가지로 멱등이다 — 없는 것을 지워도 성공한다 */
export function removeFavorite(placeId: string): Promise<void> {
  return clientFetchVoid(favoritePlacePath(placeId), { method: 'DELETE' })
}
