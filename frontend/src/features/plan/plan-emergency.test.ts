import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { beforeEach, describe, expect, it } from 'vitest'

import { PlanEmergencyHeader, PlanEmergencySection } from '@/features/plan/plan-emergency-section'
import { resolveMock } from '@/lib/api/mock'
import { mockPlanEmergency } from '@/lib/api/mock/emergency-data'
import { resetMockStore } from '@/lib/api/mock/store'
import { messages } from '@/lib/messages'
import type { PlanEmergencyResponse } from '@/types/emergency'

const TOKEN = 'mock-access-900000000000000001'
const PLAN = '223456789012000001'
const OTHERS = '223456789012000099'

const DATA = mockPlanEmergency(PLAN)

function render(data: PlanEmergencyResponse = DATA) {
  return renderToStaticMarkup(createElement(PlanEmergencySection, { data }))
}

describe('PlanEmergencySection — 목록', () => {
  it('일자별로 방문 장소와 시설을 묶어 보여 준다', () => {
    const markup = render()

    expect(markup).toContain('1일차')
    expect(markup).toContain('협재해수욕장')
    expect(markup).toContain('제주24시동물병원')
  })

  /*
    반경과 개수는 서버 고정이라 조절 컨트롤을 두지 않는다. 조절할 수 있는 것처럼 보이면
    사용자가 찾아 헤맨다 — 사실만 적는다.
  */
  it('반경을 사실로만 알리고 조절 컨트롤을 두지 않는다 — 안내는 페이지 머리에 있다 (#460)', () => {
    const header = renderToStaticMarkup(
      createElement(PlanEmergencyHeader, { planId: PLAN, radiusMeters: DATA.radiusMeters }),
    )

    expect(header).toContain('10km')
    for (const markup of [header, render()]) {
      expect(markup).not.toContain('<input')
      expect(markup).not.toContain('<select')
    }
  })

  /* 반경은 응답에서 온다 — 응답 전에는 그 줄만 비운다. 제목과 돌아가기는 그대로 선다 */
  it('반경을 아직 모르면 안내 줄을 비우고 머리는 남긴다', () => {
    const header = renderToStaticMarkup(
      createElement(PlanEmergencyHeader, { planId: PLAN, radiusMeters: null }),
    )

    expect(header).not.toContain('km')
    expect(header).toContain(messages.plan.emergencyHeading)
    expect(header).toContain(`href="/plans/${PLAN}"`)
  })

  /*
    이 응답에는 좌표가 없어 `directionsUrl` 이 링크를 만들 수 없다. 눌러도 아무 데도
    못 가는 "길찾기" 는 없는 것만 못하다 (`lib/geo/map-link.ts`).
  */
  it('길찾기 링크를 만들지 않는다 — 계약에 좌표가 없다', () => {
    expect(render()).not.toContain('map.kakao.com')
  })

  it('전화 링크는 숫자만 남겨 건다', () => {
    expect(render()).toContain('href="tel:0640000000"')
  })
})

describe('PlanEmergencySection — 빈 경우', () => {
  /*
    반경 안에 아무것도 없는 장소를 목록에서 지우면 사용자는 그 장소 주변을 확인한 것으로
    오해한다. "없다" 도 정보다.
  */
  it('반경 안에 시설이 없는 장소도 목록에 남긴다', () => {
    const markup = render()

    expect(markup).toContain('오설록 티뮤지엄')
    expect(markup).toContain(messages.plan.emergencySpotEmpty)
  })

  it('장소가 없는 일차는 제목까지 그리지 않는다', () => {
    expect(render()).not.toContain('3일차')
  })

  it('어느 일차에도 장소가 없으면 빈 상태 하나만 낸다', () => {
    const markup = render({ ...DATA, days: [{ day: 1, spots: [] }] })

    expect(markup).toContain(messages.plan.emergencyEmptyTitle)
    expect(markup).not.toContain('1일차')
  })
})

/*
  **3층 표면** (`DESIGN.md §0`, #460 — 로드맵 #455 의 7번). 일정 상세(#447)와 같은 판정 —
  일자마다 카드 하나, 장소 묶음은 카드 안 L2, 머리는 L0 위.
*/
describe('PlanEmergencySection — 3층 표면 (#460)', () => {
  const daysWithSpots = DATA.days.filter((day) => day.spots.length > 0).length

  it('장소가 있는 일차마다 Surface 카드 하나다 — 제목이 카드 안에 있다', () => {
    const markup = render()

    expect(markup.match(/<section /g)?.length).toBe(daysWithSpots)
    expect(markup).toMatch(
      /<section [^>]*class="bg-bg border-border border-y md:rounded-lg md:border"[\s\S]*?<h2[^>]*>1일차<\/h2>/,
    )
  })

  it('h1 은 카드 밖 — 섹션은 h1 을 그리지 않는다', () => {
    expect(render()).not.toContain('<h1')
  })

  it('장소 묶음 제목은 h3 캡션이고 시설 행은 카드 인셋에 선다', () => {
    const markup = render()

    expect(markup).toMatch(/<h3 class="[^"]*px-4 md:px-5"[^>]*>협재해수욕장<\/h3>/)
    expect(markup).not.toContain('md:px-10')
  })

  /* 구분선은 목록이 항목 사이에만 긋는다 — 행이 스스로 `border-border/60` 을 걸지 않는다 */
  it('묶음 사이와 시설 사이 선은 SurfaceList 가 긋고 행은 border-b 를 갖지 않는다', () => {
    const markup = render()

    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
    expect(markup).not.toContain('border-border/60')
    expect(markup).not.toMatch(/<li[^>]*border-b/)
  })

  it('빈 상태도 카드 안이다 — 상태에 따라 카드가 생겼다 사라지지 않는다', () => {
    const markup = render({ ...DATA, days: [{ day: 1, spots: [] }] })

    expect(markup).toMatch(/<section [^>]*aria-label="[^"]*"[^>]*class="bg-bg border-border/)
    expect(markup).toContain('px-4 md:px-5')
  })

  it('페이지 머리는 카드 인셋에 서고 카드는 아니다', () => {
    const header = renderToStaticMarkup(
      createElement(PlanEmergencyHeader, { planId: PLAN, radiusMeters: DATA.radiusMeters }),
    )

    expect(header).toMatch(/^<header class="[^"]*px-4 md:px-5"/)
    expect(header).not.toContain('<section')
    expect(header).not.toContain('rounded-lg')
  })
})

describe('PlanEmergencySection — 운영시간', () => {
  /*
    `operatingHoursKnown: false` 는 **휴무가 아니라 확인 필요**다 (백엔드 스키마 명시).
    닫혔다고 쓰면 실제로 여는 병원을 사용자가 건너뛴다 — 응급에서 가장 나쁜 실패다.
  */
  it('운영시간 미상을 휴무로 쓰지 않고 전화 확인을 안내한다', () => {
    const markup = render()

    expect(markup).toContain(messages.plan.emergencyHoursUnknown)
    expect(markup).not.toContain('휴무')
  })

  it('24시간 시설에 배지를 붙인다', () => {
    expect(render()).toContain(messages.plan.emergencyOpen24)
  })
})

describe('일정 응급 브리핑 mock — GET /plans/{planId}/emergency', () => {
  beforeEach(resetMockStore)

  function call(planId: string, token: string | null = TOKEN) {
    return resolveMock(`/plans/${planId}/emergency`, 'GET', '', null, token)
  }

  it('토큰이 없으면 401 이다', () => {
    expect(call(PLAN, null)?.status).toBe(401)
  })

  it('남의 일정은 404 다 — 상세와 같은 판정을 쓴다', () => {
    expect(call(OTHERS)?.status).toBe(404)
  })

  it('반경이 서버 고정값으로 온다', () => {
    const body = call(PLAN)?.payload.dataBody as PlanEmergencyResponse

    expect(body.radiusMeters).toBe(10_000)
  })

  /*
    이 응답의 시설에는 facilityId·좌표·operatingHours·openNow 가 없다. mock 이 있는 척하면
    화면이 없는 필드에 기대게 되고 실제 백엔드를 붙이는 순간 깨진다.
  */
  it('시설이 얇은 계약 그대로다 — 좌표나 facilityId 를 지어내지 않는다', () => {
    const body = call(PLAN)?.payload.dataBody as PlanEmergencyResponse
    const facility = body.days[0]?.spots[0]?.facilities[0]

    expect(facility).toBeDefined()
    expect(Object.keys(facility!).sort()).toEqual([
      'addr',
      'distanceMeters',
      'name',
      'open24',
      'operatingHoursKnown',
      'tel',
      'typeName',
    ])
  })
})
