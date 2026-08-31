import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { resetMockStore } from '@/lib/api/mock/store'
import type { ApiResponse } from '@/types/api'
import type { FavoritePlaceList } from '@/types/favorite'

/** 데모 계정(`900000000000000001`)의 토큰. `auth-data.ts` 가 이 형식을 발급한다 */
const TOKEN = 'mock-access-900000000000000001'
const OTHER = 'mock-access-900000000000000777'

/** fixture 가 저장해 둔 두 곳. `store.ts` 의 `favorites` 와 같아야 한다 */
const SAVED = MOCK_PLACES[1]!.placeId
/** 저장돼 있지 않은 장소 */
const UNSAVED = MOCK_PLACES[2]!.placeId

function list(token: string | null = TOKEN) {
  return resolveMock('/favorites/places', 'GET', '', null, token)
}

function add(placeId: string, token: string | null = TOKEN) {
  return resolveMock(`/favorites/places/${placeId}`, 'POST', '', null, token)
}

function remove(placeId: string, token: string | null = TOKEN) {
  return resolveMock(`/favorites/places/${placeId}`, 'DELETE', '', null, token)
}

function body(result: ReturnType<typeof list>): FavoritePlaceList {
  return (result?.payload as ApiResponse<FavoritePlaceList>).dataBody!
}

beforeEach(resetMockStore)

describe('즐겨찾기 mock — 인증과 소유권', () => {
  it('토큰이 없으면 401 이다 — 게이트웨이로 넘기지 않는다', () => {
    expect(list(null)?.status).toBe(401)
    expect(add(UNSAVED, null)?.status).toBe(401)
    expect(remove(SAVED, null)?.status).toBe(401)
  })

  it('남의 즐겨찾기는 섞이지 않는다', () => {
    expect(body(list(OTHER)).places).toEqual([])
    expect(body(list()).totalCount).toBe(2)
  })

  it('다른 회원이 지워도 내 저장은 남는다 — 회원별로 갈린다', () => {
    remove(SAVED, OTHER)
    expect(body(list()).places.map((place) => place.placeId)).toContain(SAVED)
  })
})

describe('즐겨찾기 mock — 저장과 해제는 멱등이다', () => {
  it('이미 저장된 장소를 다시 저장해도 성공하고 늘지 않는다', () => {
    expect(add(SAVED)?.status).toBe(200)
    expect(body(list()).totalCount).toBe(2)
  })

  it('저장돼 있지 않은 장소를 해제해도 성공한다', () => {
    expect(remove(UNSAVED)?.status).toBe(200)
    expect(body(list()).totalCount).toBe(2)
  })

  it('저장하면 목록 맨 앞에 온다 — 최근 저장순이다', () => {
    add(UNSAVED)
    expect(body(list()).places[0]?.placeId).toBe(UNSAVED)
    expect(body(list()).totalCount).toBe(3)
  })

  it('해제하면 목록에서 빠진다', () => {
    remove(SAVED)
    expect(body(list()).places.map((place) => place.placeId)).not.toContain(SAVED)
  })
})

describe('즐겨찾기 mock — 오류 계약', () => {
  it('숫자가 아닌 placeId 는 404 가 아니라 400 이다 — @PathVariable long 이라서다', () => {
    const result = add('not-a-number')
    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('FAVORITE_113')
  })

  it('없는 장소는 FAVORITE_001 이다 — 노출 불가 장소는 저장되지 않는다', () => {
    const result = add('999999999999999999')
    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('FAVORITE_001')
  })
})

describe('즐겨찾기 mock — 목록 항목', () => {
  it('장소 요약을 붙인다', () => {
    const item = body(list()).places.find((place) => place.placeId === SAVED)
    const source = MOCK_PLACES.find((place) => place.placeId === SAVED)!

    expect(item?.title).toBe(source.title)
    expect(item?.contentTypeName).toBe(source.contentType.name)
    expect(item?.petAllowanceName).toBe(source.petAllowanceType.name)
  })
})
