import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import type { PlanDayGroup } from '@/lib/plan/detail'
import type { PlanItemDetail, PlanItemPlace, PlanItemWalkCourse } from '@/types/plan'

/*
  **`next/navigation` 을 목한다.** 이 저장소의 vitest 는 node 환경이라 라우터 컨텍스트가
  없다. 카드가 읽는 것은 경로와 `?day=` 뿐이라 둘만 돌려주면 된다.

  **`next/dynamic` 도 목한다.** `MapCanvas` 는 `ssr: false` 라 서버 렌더에서 아무것도
  내지 않는 것이 정상인데, 목을 두지 않으면 청크 로더가 node 환경에서 걸린다. 지도 자체는
  이 테스트의 관심사가 아니다 — 여기서 보는 것은 **칩 · 요약 · 결손 고지**다.
*/
const searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  usePathname: () => '/plans/1',
  useSearchParams: () => searchParams,
}))

vi.mock('next/dynamic', () => ({ default: () => () => null }))

const { PlanRouteCard } = await import('@/features/plan/plan-route-card')

const HYEOPJAE: LatLng = { lat: 33.394, lng: 126.2396 }
const OSULLOC: LatLng = { lat: 33.3057, lng: 126.2896 }

function placeAt(coord: LatLng): PlanItemPlace {
  return { addr1: null, indoor: null, firstImage: null, lat: coord.lat, lng: coord.lng }
}

function courseAt(coord: LatLng): PlanItemWalkCourse {
  return {
    name: null,
    courseLabel: null,
    distanceKm: null,
    durationText: null,
    durationMaxMinutes: null,
    lat: coord.lat,
    lng: coord.lng,
    firstImage: null,
    fitsActivityLevels: [],
  }
}

function item(
  sequence: number,
  overrides: Partial<PlanItemDetail> & { day?: number } = {},
): PlanItemDetail {
  const day = overrides.day ?? 1
  const code = overrides.itemType?.code ?? 'PLACE'

  return {
    planItemId: `item-${String(day)}-${String(sequence)}`,
    day,
    sequence,
    targetId: '212481712381923328',
    title: `장소 ${String(sequence)}`,
    memo: null,
    startTime: null,
    visited: false,
    place: null,
    walkCourse: null,
    ...overrides,
    itemType: overrides.itemType ?? { code, name: code, description: '' },
  }
}

function render(days: PlanDayGroup<PlanItemDetail>[], totalDays = days.length) {
  return renderToStaticMarkup(createElement(PlanRouteCard, { totalDays, days }))
}

describe('PlanRouteCard — 그릴 것이 없으면 카드가 없다', () => {
  it('항목이 없는 일자에는 아무것도 렌더하지 않는다', () => {
    expect(render([{ day: 1, items: [] }])).toBe('')
  })

  /* 좌표가 하나도 없으면 찍을 자리도 이을 선도 없다 — 빈 지도를 띄우지 않는다 */
  it('좌표가 하나도 없으면 아무것도 렌더하지 않는다', () => {
    expect(render([{ day: 1, items: [item(1), item(2)] }])).toBe('')
  })
})

describe('PlanRouteCard — 요약 줄', () => {
  it('일자와 곳 수를 말한다', () => {
    const html = render([
      {
        day: 1,
        items: [item(1, { place: placeAt(HYEOPJAE) }), item(2, { place: placeAt(OSULLOC) })],
      },
    ])

    expect(html).toContain(messages.map.routeSummary.replace('{day}', '1').replace('{n}', '2'))
  })

  /*
    **직선임을 밝힌다.** 제주는 산간을 우회해야 해서 주행거리와 크게 다르다 — 항목 행의
    거리 줄과 같은 약속이다.
  */
  it('합계에 직선임을 밝힌다', () => {
    const html = render([
      {
        day: 1,
        items: [item(1, { place: placeAt(HYEOPJAE) }), item(2, { place: placeAt(OSULLOC) })],
      },
    ])

    expect(html).toContain('직선 합계')
  })

  /* 정류점이 하나면 이을 선이 없다 — `직선 합계 0m` 은 거짓말이다 */
  it('정류점이 하나뿐이면 합계를 말하지 않는다', () => {
    const html = render([{ day: 1, items: [item(1, { place: placeAt(HYEOPJAE) })] }])

    expect(html).toContain(messages.map.routeSummary.replace('{day}', '1').replace('{n}', '1'))
    expect(html).not.toContain('직선 합계')
  })
})

describe('PlanRouteCard — 결손 고지', () => {
  /* 핀 번호는 보이는 것만 센다. 그래서 몇 곳이 빠졌는지는 이 줄만이 말할 수 있다 */
  it('좌표 없는 항목 수를 말한다', () => {
    const html = render([
      {
        day: 1,
        items: [
          item(1, { place: placeAt(HYEOPJAE) }),
          item(2, { place: placeAt(OSULLOC) }),
          item(3),
        ],
      },
    ])

    expect(html).toContain(messages.map.routeOmitted.replace('{n}', '1'))
  })

  it('결손이 없으면 그 줄이 없다', () => {
    const html = render([
      {
        day: 1,
        items: [item(1, { place: placeAt(HYEOPJAE) }), item(2, { place: placeAt(OSULLOC) })],
      },
    ])

    expect(html).not.toContain('위치를 알 수 없어')
  })

  /* `MOVE` 는 원래 가리킬 자리가 없다 — 세면 고지 줄이 늘 떠 있는 장식이 된다 */
  it('MOVE 항목은 결손으로 세지 않는다', () => {
    const html = render([
      {
        day: 1,
        items: [
          item(1, { place: placeAt(HYEOPJAE) }),
          item(2, { itemType: { code: 'MOVE', name: 'MOVE', description: '' } }),
          item(3, { place: placeAt(OSULLOC) }),
        ],
      },
    ])

    expect(html).not.toContain('위치를 알 수 없어')
  })

  /* 올레 항목은 코스 시작점으로 찍힌다 — 지도는 거리 줄보다 넓게 본다 (#743) */
  it('올레 코스 좌표도 정류점으로 센다', () => {
    const html = render([
      {
        day: 1,
        items: [
          item(1, { place: placeAt(HYEOPJAE) }),
          item(2, {
            itemType: { code: 'WALK', name: 'WALK', description: '' },
            walkCourse: courseAt(OSULLOC),
          }),
        ],
      },
    ])

    expect(html).toContain(messages.map.routeSummary.replace('{day}', '1').replace('{n}', '2'))
  })
})

describe('PlanRouteCard — 일자 칩', () => {
  it('일자 수만큼 칩을 그리고 선택된 칩만 표시한다', () => {
    const html = render([
      {
        day: 1,
        items: [item(1, { place: placeAt(HYEOPJAE) }), item(2, { place: placeAt(OSULLOC) })],
      },
      { day: 2, items: [item(1, { day: 2, place: placeAt(OSULLOC) })] },
    ])

    expect(html).toContain(messages.map.routeDayChip.replace('{day}', '1'))
    expect(html).toContain(messages.map.routeDayChip.replace('{day}', '2'))
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
  })

  /* 하루짜리 일정에 고를 것이 없다 — 칩 하나만 선 축은 축이 아니다 */
  it('하루짜리 일정에는 칩을 그리지 않는다', () => {
    const html = render([{ day: 1, items: [item(1, { place: placeAt(HYEOPJAE) })] }])

    expect(html).not.toContain(messages.map.routeDayAxis)
  })

  /* 모바일에서는 지도와 일자 카드가 동시에 보이지 않아 해시가 그 일자로 데려간다 */
  it('칩 링크가 일자 앵커를 함께 싣는다', () => {
    const html = render([
      { day: 1, items: [item(1, { place: placeAt(HYEOPJAE) })] },
      { day: 2, items: [item(1, { day: 2, place: placeAt(OSULLOC) })] },
    ])

    expect(html).toContain('?day=2#')
  })
})
