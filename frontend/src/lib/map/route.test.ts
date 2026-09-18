import { describe, expect, it } from 'vitest'

import { LONG_TRIP_THRESHOLD_M } from '@/lib/geo/distance'
import { routeCamera, type RouteItemInput, toRouteModel, toRouteSegments } from '@/lib/map/route'

/** 제주 서부 — 협재 부근. 서로 2km 안쪽이라 긴 이동이 아니다 */
const HYEOPJAE = { lat: 33.394, lng: 126.2396 }
const HALLIM = { lat: 33.3888, lng: 126.24 }
const OSULLOC = { lat: 33.3057, lng: 126.2896 }
/** 성산 — 협재에서 직선 50km 가 넘는다 */
const SEONGSAN = { lat: 33.4581, lng: 126.9426 }

function item(id: string, coord: RouteItemInput['coord'], itemTypeCode = 'PLACE'): RouteItemInput {
  return { id, itemTypeCode, title: id, coord }
}

describe('toRouteModel — 정류점', () => {
  it('좌표가 있는 항목만 정류점이 되고 순번은 1부터다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', HALLIM), item('c', OSULLOC)],
      lodgingBasis: null,
    })

    expect(model.stops.map((stop) => stop.id)).toEqual(['a', 'b', 'c'])
    expect(model.stops.map((stop) => stop.order)).toEqual([1, 2, 3])
  })

  /*
    핀 번호가 `1, 2, 4` 로 튀면 사용자는 "3번이 어디 갔나" 를 묻게 된다. 그 답은 지도가
    아니라 결손 고지 줄이 한다 — 핀은 **보이는 것들의 순서**만 말한다.
  */
  it('좌표 없는 항목을 건너뛰어도 순번이 이어진다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', null), item('c', OSULLOC)],
      lodgingBasis: null,
    })

    expect(model.stops.map((stop) => stop.id)).toEqual(['a', 'c'])
    expect(model.stops.map((stop) => stop.order)).toEqual([1, 2])
  })

  it('좌표 없는 항목을 결손으로 센다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', null), item('c', null)],
      lodgingBasis: null,
    })

    expect(model.omittedCount).toBe(2)
  })

  /*
    `MOVE` 는 원래 가리킬 자리가 없다. 세면 "위치를 알 수 없는 곳" 이 이동 항목을 쓰는
    일정마다 1 이상이 되어, 고지 줄이 늘 떠 있는 장식이 된다.
  */
  it('MOVE 항목은 결손으로 세지 않는다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('m', null, 'MOVE'), item('c', OSULLOC)],
      lodgingBasis: null,
    })

    expect(model.omittedCount).toBe(0)
    expect(model.stops).toHaveLength(2)
  })

  it('좌표가 하나도 없으면 정류점도 구간도 없다 — 호출부가 카드를 그리지 않는다', () => {
    const model = toRouteModel({ items: [item('a', null)], lodgingBasis: null })

    expect(model.stops).toHaveLength(0)
    expect(model.legs).toHaveLength(0)
  })
})

describe('toRouteModel — 구간', () => {
  it('이웃한 정류점을 잇는다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', HALLIM), item('c', OSULLOC)],
      lodgingBasis: null,
    })

    expect(model.legs.map((leg) => [leg.fromId, leg.toId])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ])
  })

  it('정류점이 하나뿐이면 선을 그리지 않는다', () => {
    const model = toRouteModel({ items: [item('a', HYEOPJAE)], lodgingBasis: null })

    expect(model.stops).toHaveLength(1)
    expect(model.legs).toHaveLength(0)
  })

  /* 숙소 기준점은 `lodgingBasisFor` 가 정한다 — 거리 줄과 같은 규칙을 지도가 그대로 쓴다 */
  it('앞선 날의 숙소가 있으면 첫 정류점으로 들어오는 구간이 생긴다', () => {
    const model = toRouteModel({
      items: [item('a', HALLIM), item('b', OSULLOC)],
      lodgingBasis: item('lodging', HYEOPJAE, 'LODGING'),
    })

    expect(model.legs[0]?.fromId).toBe('lodging')
    expect(model.legs[0]?.fromLodging).toBe(true)
    expect(model.legs[1]?.fromLodging).toBe(false)
  })

  it('숙소에 좌표가 없으면 진입 구간을 만들지 않는다', () => {
    const model = toRouteModel({
      items: [item('a', HALLIM), item('b', OSULLOC)],
      lodgingBasis: item('lodging', null, 'LODGING'),
    })

    expect(model.legs).toHaveLength(1)
    expect(model.legs[0]?.fromLodging).toBe(false)
  })

  it('30km 이상 구간을 긴 이동으로 표시한다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', SEONGSAN)],
      lodgingBasis: null,
    })

    expect(model.legs[0]?.straightMeters).toBeGreaterThanOrEqual(LONG_TRIP_THRESHOLD_M)
    expect(model.legs[0]?.long).toBe(true)
  })

  it('가까운 구간은 긴 이동이 아니다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', HALLIM)],
      lodgingBasis: null,
    })

    expect(model.legs[0]?.long).toBe(false)
  })
})

describe('toRouteModel — 합계', () => {
  it('구간 거리의 합이다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', HALLIM), item('c', OSULLOC)],
      lodgingBasis: null,
    })

    const sum = model.legs.reduce((acc, leg) => acc + leg.straightMeters, 0)
    expect(model.totalStraightMeters).toBeCloseTo(sum, 6)
  })

  /*
    합계는 **그날 움직인 거리**다. 숙소 진입은 어제와 오늘의 이음매라 오늘의 이동이
    아니고, 넣으면 같은 일정을 1일차부터 읽어 내려갈 때 합계가 이유 없이 뛴다.
  */
  it('숙소 진입 구간은 합계에 넣지 않는다', () => {
    const withLodging = toRouteModel({
      items: [item('a', HALLIM), item('b', OSULLOC)],
      lodgingBasis: item('lodging', SEONGSAN, 'LODGING'),
    })
    const without = toRouteModel({
      items: [item('a', HALLIM), item('b', OSULLOC)],
      lodgingBasis: null,
    })

    expect(withLodging.totalStraightMeters).toBeCloseTo(without.totalStraightMeters, 6)
  })
})

describe('toRouteSegments', () => {
  it('구간마다 선 하나를 만든다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', HALLIM), item('c', OSULLOC)],
      lodgingBasis: null,
    })

    const segments = toRouteSegments(model.legs)

    expect(segments).toHaveLength(2)
    expect(segments[0]?.path).toEqual([HYEOPJAE, HALLIM])
    expect(segments.every((segment) => segment.tone === 'default')).toBe(true)
  })

  it('긴 구간은 emphasis 다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', SEONGSAN)],
      lodgingBasis: null,
    })

    expect(toRouteSegments(model.legs)[0]?.tone).toBe('emphasis')
  })

  /*
    **숙소 진입이 길어도 dashed 다.** 그 구간은 오늘의 이동이 아니라 어제와 오늘의
    이음매이고, 거리는 행의 `숙소에서 직선 N km` 가 이미 말한다. 톤 하나에 두 가지
    뜻을 겹치면 굵은 점선이 무엇을 말하는지 읽을 수 없다.
  */
  it('숙소 진입은 길어도 dashed 다', () => {
    const model = toRouteModel({
      items: [item('a', HALLIM)],
      lodgingBasis: item('lodging', SEONGSAN, 'LODGING'),
    })

    expect(model.legs[0]?.long).toBe(true)
    expect(toRouteSegments(model.legs)[0]?.tone).toBe('dashed')
  })
})

describe('routeCamera', () => {
  it('정류점이 없으면 카메라도 없다', () => {
    expect(routeCamera([])).toBeNull()
  })

  it('기준점은 정류점을 담는 사각형의 가운데다', () => {
    const model = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', OSULLOC)],
      lodgingBasis: null,
    })
    const camera = routeCamera(model.stops)

    expect(camera?.anchor.lat).toBeCloseTo((HYEOPJAE.lat + OSULLOC.lat) / 2, 6)
    expect(camera?.anchor.lng).toBeCloseTo((HYEOPJAE.lng + OSULLOC.lng) / 2, 6)
  })

  /* 핀 하나짜리 일자에서 폭이 0 이 되면 SDK 가 최대 배율로 확대해 아무것도 안 보인다 */
  it('정류점이 하나여도 폭이 0 이 되지 않는다', () => {
    const camera = routeCamera([{ id: 'a', order: 1, title: 'a', coord: HYEOPJAE }])

    expect(camera?.spanMeters).toBeGreaterThan(0)
  })

  it('멀리 떨어진 정류점일수록 담는 폭이 넓다', () => {
    const near = routeCamera(
      toRouteModel({ items: [item('a', HYEOPJAE), item('b', HALLIM)], lodgingBasis: null }).stops,
    )
    const far = routeCamera(
      toRouteModel({ items: [item('a', HYEOPJAE), item('b', SEONGSAN)], lodgingBasis: null }).stops,
    )

    expect(far?.spanMeters).toBeGreaterThan(near?.spanMeters ?? 0)
  })
})
