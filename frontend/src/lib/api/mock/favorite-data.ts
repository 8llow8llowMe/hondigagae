import type { MockResult } from '@/lib/api/mock/auth-data'
import { bindPathVariable } from '@/lib/api/mock/path-variable'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { memberIdOf, mockStore, nextFavoriteId } from '@/lib/api/mock/store'
import type { ApiResponse } from '@/types/api'
import type { FavoritePlaceItem, FavoritePlaceList } from '@/types/favorite'

/**
 * 장소 즐겨찾기 mock.
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다** (`plan-data.ts` 와 같은 규칙).
 * 특히 저장·해제의 **멱등성**을 흉내 내지 않으면 화면의 토글 연타 가드를 검증할 수 없다 —
 * 실제로는 통과하는 조작이 mock 에서만 오류로 보인다.
 *
 * 근거: `FavoriteWebController` · `FavoriteCommandProcessor` · `FavoriteQueryProcessor` ·
 * `FavoritePlacesResponse` · `FavoritePlaceItem` · `FavoriteErrorCode` 소스 실측.
 */

/** 백엔드 상한. `MAX_FAVORITE_COUNT` (`FavoriteCommandProcessor`) 와 같아야 한다 */
const MAX_FAVORITE_COUNT = 100

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: string): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

// `SecurityErrorCode.UNAUTHORIZED` — 게이트웨이가 내는 코드다 (다른 보호 리소스와 같다)
const UNAUTHORIZED = (): MockResult => fail(401, 'SECURITY_001', '인증이 필요합니다.')

/**
 * 장소 요약을 붙인다. **`MOCK_PLACES` 에 없으면 placeId 만 남기고 전부 null 이다** —
 * 백엔드도 tour-service 조회가 실패하면 같은 모양을 낸다(`FavoritePlaceItem` 주석).
 * 화면의 "요약 없는 행" 경로가 mock 에서 실제로 나와야 한다.
 */
function toItem(placeId: string): FavoritePlaceItem {
  const place = MOCK_PLACES.find((candidate) => candidate.placeId === placeId)
  if (place === undefined) {
    return {
      placeId,
      title: null,
      contentTypeName: null,
      addr: null,
      petAllowanceName: null,
      indoor: null,
      firstImage: null,
    }
  }

  return {
    placeId,
    title: place.title,
    contentTypeName: place.contentType.name,
    addr: place.addr1,
    petAllowanceName: place.petAllowanceType.name,
    indoor: place.indoor,
    firstImage: place.firstImage,
  }
}

export function resolveFavoriteMock(
  path: string,
  method: string,
  accessToken: string | null,
): MockResult | null {
  if (!path.startsWith('/favorites/places')) return null

  // 세 엔드포인트가 모두 @PreAuthorize("isAuthenticated()") 다
  const memberId = memberIdOf(accessToken)
  if (memberId === null) return UNAUTHORIZED()

  if (path === '/favorites/places' && method === 'GET') return list(memberId)

  const single = /^\/favorites\/places\/([^/]+)$/.exec(path)
  if (single !== null) {
    const rawId = single[1] ?? ''

    /*
      **숫자가 아닌 placeId 는 404 가 아니라 400 이다** — 컨트롤러가 `@PathVariable long`
      이라 바인딩 단계에서 걸린다 (장소 상세의 `PLACE_113` 과 같은 상황).

      문구·`fieldErrors`·문법은 도메인을 가리지 않고 같다 — 공용 `bindPathVariable` 이
      정본이고 여기서는 도메인 코드만 얹는다 (#813).
    */
    const placeId = bindPathVariable('FAVORITE_113', 'placeId', rawId)
    if (typeof placeId !== 'string') return placeId

    if (method === 'POST') return add(memberId, placeId)
    if (method === 'DELETE') return remove(memberId, placeId)
  }

  return null
}

/** 최근 저장순. 저장 배열을 뒤집는다 — 시각 필드를 두지 않는 이유는 store.ts 에 적었다 */
function list(memberId: string): MockResult {
  const mine = mockStore().favorites.filter((favorite) => favorite.memberId === memberId)
  const places = [...mine].reverse().map((favorite) => toItem(favorite.placeId))

  return { status: 200, payload: ok<FavoritePlaceList>({ places, totalCount: places.length }) }
}

/**
 * 저장. **멱등이다** — 이미 저장돼 있으면 아무것도 하지 않고 성공한다.
 *
 * 순서가 백엔드와 같아야 한다: 중복 → 상한 → 장소 존재. 상한 검사를 장소 존재보다
 * 뒤에 두면 101번째 저장에서 `FAVORITE_001` 이 나와 화면이 엉뚱한 안내를 낸다.
 */
function add(memberId: string, placeId: string): MockResult {
  const store = mockStore()
  const existing = store.favorites.find(
    (favorite) => favorite.memberId === memberId && favorite.placeId === placeId,
  )
  if (existing !== undefined) return { status: 200, payload: ok(null) }

  const count = store.favorites.filter((favorite) => favorite.memberId === memberId).length
  if (count >= MAX_FAVORITE_COUNT) {
    return fail(400, 'FAVORITE_002', '저장할 수 있는 즐겨찾기 수를 초과했습니다.')
  }

  // 노출 불가(병합·delisted) 장소는 tour-service 조회에서 빠진다 — 저장되지 않는다
  if (!MOCK_PLACES.some((place) => place.placeId === placeId)) {
    return fail(400, 'FAVORITE_001', '즐겨찾기할 장소를 찾을 수 없습니다.')
  }

  store.favorites.push({ favoriteId: nextFavoriteId(store), memberId, placeId })
  return { status: 200, payload: ok(null) }
}

/** 해제. 저장과 마찬가지로 멱등이다 — 없는 것을 지워도 성공한다 */
function remove(memberId: string, placeId: string): MockResult {
  const store = mockStore()
  const index = store.favorites.findIndex(
    (favorite) => favorite.memberId === memberId && favorite.placeId === placeId,
  )
  if (index >= 0) store.favorites.splice(index, 1)

  return { status: 200, payload: ok(null) }
}
