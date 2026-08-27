import { describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import type { SliceResponse } from '@/types/api'
import type { PlaceDetail, PlaceSummary } from '@/types/place'

function list(search: string) {
  const result = resolveMock('/places', 'GET', search)
  if (result === null) throw new Error('mock 이 경로를 처리하지 못했다')
  return result
}

function body(search: string): SliceResponse<PlaceSummary> {
  return list(search).payload.dataBody as SliceResponse<PlaceSummary>
}

describe('resolveMock — 처리 범위', () => {
  it('구현되지 않은 경로는 null 을 반환해 실제 게이트웨이로 넘긴다', () => {
    expect(resolveMock('/plans', 'GET', '')).toBeNull()
    expect(resolveMock('/emergencies/facilities', 'GET', '')).toBeNull()
  })

  it('GET 이 아니면 처리하지 않는다', () => {
    expect(resolveMock('/places', 'POST', '')).toBeNull()
  })
})

describe('resolveMock — 목록 페이지네이션', () => {
  it('기본 size 는 20 이다', () => {
    expect(body('').contents).toHaveLength(20)
  })

  it('마지막 placeId 를 커서로 다음 페이지를 준다', () => {
    const first = body('size=5')
    const cursor = first.contents.at(-1)?.placeId ?? ''
    const second = body(`size=5&lastPlaceId=${cursor}`)

    expect(second.contents[0]?.placeId).not.toBe(first.contents[0]?.placeId)
    expect(first.contents.map((p) => p.placeId)).not.toContain(second.contents[0]?.placeId)
  })

  it('끝까지 가면 hasNext 가 false 다', () => {
    expect(body('size=50').hasNext).toBe(false)
  })

  it('size 가 허용 범위를 벗어나면 400 이다 (백엔드와 동일)', () => {
    expect(list('size=0').status).toBe(400)
    expect(list('size=51').status).toBe(400)
  })
})

describe('resolveMock — 필터', () => {
  it('contentType 으로 거른다', () => {
    const contents = body('contentType=RESTAURANT&size=50').contents

    expect(contents.length).toBeGreaterThan(0)
    expect(contents.every((p) => p.contentType.code === 'RESTAURANT')).toBe(true)
  })

  it('petAllowanceType 으로 거른다', () => {
    const contents = body('petAllowanceType=ALLOWED&size=50').contents

    expect(contents.every((p) => p.petAllowanceType.code === 'ALLOWED')).toBe(true)
  })

  it('indoor 정보가 없는 장소는 true/false 어느 쪽으로도 잡히지 않는다', () => {
    const unknown = MOCK_PLACES.filter((p) => p.indoor === null)
    expect(unknown.length).toBeGreaterThan(0)

    const indoorTrue = body('indoor=true&size=50').contents
    const indoorFalse = body('indoor=false&size=50').contents

    expect(indoorTrue.every((p) => p.indoor === true)).toBe(true)
    expect(indoorFalse.every((p) => p.indoor === false)).toBe(true)
  })

  it('조건에 맞는 결과가 없으면 빈 목록을 준다 (404 가 아니다)', () => {
    const result = list('contentType=FESTIVAL&size=50')

    expect(result.status).toBe(200)
    expect((result.payload.dataBody as SliceResponse<PlaceSummary>).contents).toHaveLength(0)
  })
})

describe('resolveMock — 상세', () => {
  function detail(placeId: string) {
    const result = resolveMock(`/places/${placeId}`, 'GET', '')
    if (result === null) throw new Error('mock 이 경로를 처리하지 못했다')
    return result
  }

  it('목록 타입이 아니라 상세 타입을 반환한다', () => {
    const id = MOCK_PLACES[0]?.placeId ?? ''
    const result = detail(id)
    const body = result.payload.dataBody as PlaceDetail

    expect(result.status).toBe(200)
    expect(body.placeId).toBe(id)
    // 목록(PlaceItem)에는 없고 상세(PlaceDetailResponse)에만 있는 필드다
    expect(body).toHaveProperty('overview')
    expect(body).toHaveProperty('images')
    expect(Array.isArray(body.images)).toBe(true)
  })

  it('없는 장소는 404 이고 백엔드와 같은 resultCode 를 쓴다', () => {
    const result = detail('999999999999999999')

    expect(result.status).toBe(404)
    expect(result.payload.dataHeader.success).toBe(false)
    expect(result.payload.dataHeader.resultCode).toBe('PLACE_002')
  })

  it('숫자가 아닌 placeId 는 404 가 아니라 400 이다 (@PathVariable long)', () => {
    const result = detail('abc')

    expect(result.status).toBe(400)
    expect(result.payload.dataHeader.resultCode).toBe('PLACE_113')
  })

  it('/places/nearby 는 상세가 아니다 — 실제 게이트웨이로 넘긴다', () => {
    expect(resolveMock('/places/nearby', 'GET', 'lat=33.5&lng=126.5')).toBeNull()
  })
})

describe('mock 상세 데이터 품질', () => {
  function detailOf(placeId: string): PlaceDetail {
    const result = resolveMock(`/places/${placeId}`, 'GET', '')
    return result?.payload.dataBody as PlaceDetail
  }

  const details = MOCK_PLACES.map((place) => detailOf(place.placeId))

  it('intro 가 통째로 없는 케이스를 포함한다 — 섹션 숨김이 기본 경로에 드러나야 한다', () => {
    expect(details.some((detail) => detail.intro === null)).toBe(true)
  })

  it('petInfo 가 통째로 없는 케이스를 포함한다', () => {
    expect(details.some((detail) => detail.petInfo === null)).toBe(true)
  })

  it('images 가 비어 있는 케이스를 포함하고, images 는 절대 null 이 아니다', () => {
    expect(details.some((detail) => detail.images.length === 0)).toBe(true)
    expect(details.every((detail) => Array.isArray(detail.images))).toBe(true)
  })

  it('homepage 에 HTML anchor 원문이 들어 있는 케이스를 포함한다', () => {
    expect(details.some((detail) => detail.homepage?.includes('<a ') === true)).toBe(true)
  })

  it('목록과 같은 장소를 보여준다 — 상세만 다른 장소면 개발 중에만 있는 착시가 생긴다', () => {
    const summary = MOCK_PLACES[0]
    if (summary === undefined) throw new Error('mock 데이터가 비어 있다')

    expect(detailOf(summary.placeId).title).toBe(summary.title)
  })
})

describe('mock 데이터 품질', () => {
  it('문자열 placeId 를 쓴다 (정밀도 손상 방지)', () => {
    expect(MOCK_PLACES.every((p) => typeof p.placeId === 'string')).toBe(true)
  })

  it('placeId 가 중복되지 않는다', () => {
    expect(new Set(MOCK_PLACES.map((p) => p.placeId)).size).toBe(MOCK_PLACES.length)
  })

  it('nullable 필드가 실제로 비어 있는 케이스를 포함한다', () => {
    expect(MOCK_PLACES.some((p) => p.addr1 === null)).toBe(true)
    expect(MOCK_PLACES.some((p) => p.tel === null)).toBe(true)
    expect(MOCK_PLACES.some((p) => p.indoor === null)).toBe(true)
    expect(MOCK_PLACES.every((p) => p.firstImage === null)).toBe(true)
  })

  it('좌표가 제주 범위 안에 있다', () => {
    expect(
      MOCK_PLACES.every(
        (p) =>
          p.lat !== null &&
          p.lng !== null &&
          p.lat > 33.1 &&
          p.lat < 33.6 &&
          p.lng > 126.1 &&
          p.lng < 126.9,
      ),
    ).toBe(true)
  })
})
