import { describe, expect, it } from 'vitest'

import { LONG_TRIP_THRESHOLD_M } from '@/lib/geo/distance'
import {
  routeCamera,
  routeCameraKey,
  type RouteItemInput,
  selectedIdForDay,
  toRouteModel,
  toRouteSegments,
} from '@/lib/map/route'
import { framedCamera, metersPerPixel } from '@/lib/map/viewport'

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

    expect(camera?.spanMeters.widthMeters).toBeGreaterThan(0)
    expect(camera?.spanMeters.heightMeters).toBeGreaterThan(0)
  })

  it('멀리 떨어진 정류점일수록 담는 폭이 넓다', () => {
    const near = routeCamera(
      toRouteModel({ items: [item('a', HYEOPJAE), item('b', HALLIM)], lodgingBasis: null }).stops,
    )
    const far = routeCamera(
      toRouteModel({ items: [item('a', HYEOPJAE), item('b', SEONGSAN)], lodgingBasis: null }).stops,
    )

    expect(far?.spanMeters.widthMeters).toBeGreaterThan(near?.spanMeters.widthMeters ?? 0)
  })

  /*
    **두 축을 따로 넘긴다** (#982). 긴 변 하나로 접으면 `framedCamera` 가 그것을 컨테이너의
    **짧은 변**에 맞추는데, 동선 칸은 가로로 넓고 제주 동선은 대개 동서로 길다 — 긴 쪽끼리가
    아니라 긴 쪽을 짧은 쪽에 맞추게 되어 한두 단계 멀어졌다.
  */
  it('동서 폭과 남북 폭을 따로 준다', () => {
    const camera = routeCamera(ISSUE_DAY_STOPS)

    expect(camera?.spanMeters.widthMeters).toBeCloseTo(72_453, -1)
    expect(camera?.spanMeters.heightMeters).toBeCloseTo(18_156, -1)
  })
})

/*
  #982 재현 — 1일차 세 곳(직선 합계 74.6km, 1 · 2번 사이 9.0km).

  좌표는 공개 좌표이고 두 구간 합이 이슈의 74.6km 와 맞는다(8.97 + 65.67).
  컨테이너는 실측 크기다(`viewport.test.ts` 의 #982 주석). 고치기 전에는 두 크기 모두
  단계 12 였고, 그 배율에서 세 곳은 888 폭 중 142px 에 몰리고 1 · 2번 핀(지름 32px)의
  중심이 18px 떨어져 겹쳤다 — 카카오 5174 실측과 같다.
*/
const SUWOLBONG = { lat: 33.2958, lng: 126.1631 }
const SPIRITED_GARDEN = { lat: 33.3217, lng: 126.2545 }
const SEONGSAN_ILCHULBONG = { lat: 33.4589, lng: 126.9425 }

const ISSUE_DAY_STOPS = toRouteModel({
  items: [
    item('suwolbong', SUWOLBONG),
    item('garden', SPIRITED_GARDEN),
    item('seongsan', SEONGSAN_ILCHULBONG),
  ],
  lodgingBasis: null,
}).stops

/** 순번 핀 반지름(px) — `.map-pin-order` 32×32 */
const ORDER_PIN_RADIUS_PX = 16

describe('routeCamera × framedCamera — #982', () => {
  const cases = [
    { name: '데스크톱 1366 (888×256)', width: 888, height: 256, level: 10 },
    { name: '모바일 390 (358×224)', width: 358, height: 224, level: 11 },
  ] as const

  for (const size of cases) {
    const frame = routeCamera(ISSUE_DAY_STOPS)
    if (frame === null) throw new Error('정류점이 있는데 카메라가 없다')

    const camera = framedCamera({
      anchor: frame.anchor,
      spanMeters: frame.spanMeters,
      width: size.width,
      height: size.height,
      seaRatio: 0.5,
    })

    /** 화면 좌표(px). 중심이 컨테이너 가운데다 */
    const toPixel = (coord: { lat: number; lng: number }) => {
      const mpp = metersPerPixel(camera.level)
      const cos = Math.cos((camera.lat * Math.PI) / 180)
      return {
        x: size.width / 2 + ((coord.lng - camera.lng) * 111_320 * cos) / mpp,
        y: size.height / 2 - ((coord.lat - camera.lat) * 111_320) / mpp,
      }
    }

    // 기대값 10 · 11 의 근거는 5174 카카오 `setBounds` 실측이다(명세 D4). 이 테스트는 그것을
    // 부르지 않는다 — `metersPerPixel` 투영식으로 우리 계산을 잰다
    it(`${size.name} — 축별로 맞춘 단계가 ${String(size.level)} 이다`, () => {
      expect(camera.level).toBe(size.level)
    })

    it(`${size.name} — 세 핀이 원째로 칸 안에 든다`, () => {
      for (const stop of ISSUE_DAY_STOPS) {
        const { x, y } = toPixel(stop.coord)
        expect(x).toBeGreaterThanOrEqual(ORDER_PIN_RADIUS_PX)
        expect(x).toBeLessThanOrEqual(size.width - ORDER_PIN_RADIUS_PX)
        expect(y).toBeGreaterThanOrEqual(ORDER_PIN_RADIUS_PX)
        expect(y).toBeLessThanOrEqual(size.height - ORDER_PIN_RADIUS_PX)
      }
    })

    it(`${size.name} — 1 · 2번 핀(9.0km)이 겹치지 않는다`, () => {
      const a = toPixel(SUWOLBONG)
      const b = toPixel(SPIRITED_GARDEN)

      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(ORDER_PIN_RADIUS_PX * 2)
    })
  }
})

/*
  #982 리뷰 H-1 — **값이 같으면 카메라가 같아야 한다.**

  `plan-detail-section` 은 렌더마다 `groupItemsByDay` 로 새 배열을 만든다. 카메라 memo 를
  배열 참조에 걸면 날씨 · 위험도 쿼리가 늦게 도착하거나 일자 편집에 들어갈 때마다 새 카메라가
  되어, 사용자가 끌어 둔 지도가 그날 사각형으로 되돌아간다. 그래서 memo 를 **값 서명**에
  건다 — 서명이 같으면 같은 카메라 객체가 유지된다.
*/
describe('routeCameraKey', () => {
  const stopsOf = () =>
    toRouteModel({
      items: [item('a', HYEOPJAE), item('b', OSULLOC)],
      lodgingBasis: null,
    }).stops

  it('새로 만든 같은 값의 배열이면 서명이 같다', () => {
    const first = stopsOf()
    const second = stopsOf()

    expect(second).not.toBe(first)
    expect(routeCameraKey(1, second)).toBe(routeCameraKey(1, first))
  })

  it('일자가 다르면 서명이 다르다', () => {
    expect(routeCameraKey(2, stopsOf())).not.toBe(routeCameraKey(1, stopsOf()))
  })

  it('좌표가 바뀌면 서명이 다르다', () => {
    const moved = toRouteModel({
      items: [item('a', HYEOPJAE), item('b', SEONGSAN)],
      lodgingBasis: null,
    }).stops

    expect(routeCameraKey(1, moved)).not.toBe(routeCameraKey(1, stopsOf()))
  })

  it('항목이 바뀌면 좌표가 같아도 서명이 다르다', () => {
    const renamed = toRouteModel({
      items: [item('x', HYEOPJAE), item('b', OSULLOC)],
      lodgingBasis: null,
    }).stops

    expect(routeCameraKey(1, renamed)).not.toBe(routeCameraKey(1, stopsOf()))
  })

  /* 이름표 문구는 카메라와 무관하다 — 제목만 고쳐도 지도가 되돌아가면 안 된다 */
  it('제목만 바뀌면 서명이 같다', () => {
    const retitled = toRouteModel({
      items: [{ ...item('a', HYEOPJAE), title: '새 이름' }, item('b', OSULLOC)],
      lodgingBasis: null,
    }).stops

    expect(routeCameraKey(1, retitled)).toBe(routeCameraKey(1, stopsOf()))
  })
})

/*
  #982 리뷰 M-1 — **일자를 바꾸면 선택이 풀린다.**

  선택은 그 일자의 핀을 가리킨다. 남겨 두면 새 일자 카메라가 선택 상태로 맞춰지는데,
  고른 핀은 이름표(최대 180px)로 커져 가장자리 핀이면 칸 밖으로 잘린다 — 모바일
  358px 칸에서 1번 핀 중심은 x≈37 이다.
*/
describe('selectedIdForDay', () => {
  it('그 일자에서 고른 핀이면 그대로다', () => {
    expect(selectedIdForDay({ day: 2, id: 'a' }, 2)).toBe('a')
  })

  it('다른 일자에서 고른 핀이면 풀린다', () => {
    expect(selectedIdForDay({ day: 1, id: 'a' }, 2)).toBeNull()
  })

  it('고른 적이 없으면 없다', () => {
    expect(selectedIdForDay(null, 1)).toBeNull()
  })
})
