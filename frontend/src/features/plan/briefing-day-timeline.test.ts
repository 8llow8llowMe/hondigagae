import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { BriefingDayTimeline } from '@/features/plan/briefing-day-timeline'
import { messages } from '@/lib/messages'
import { planItem } from '@/test/fixtures/plan'

const MOVE = { code: 'MOVE', name: '이동', description: null }
const items = [
  planItem({
    planItemId: 'a',
    day: 1,
    sequence: 0,
    targetId: 'P1',
    title: '중문색달해수욕장',
    startTime: '10:05:00',
  }),
  planItem({
    planItemId: 'b',
    day: 1,
    sequence: 1,
    targetId: 'P2',
    title: '식당',
    visited: true,
  }),
  planItem({
    planItemId: 'm',
    day: 1,
    sequence: 2,
    itemType: MOVE,
    targetId: null,
    title: '이동',
    place: null,
  }),
  planItem({
    planItemId: 'c',
    day: 1,
    sequence: 3,
    targetId: 'P3',
    title: '메모장소',
    place: null,
  }),
]

function render(overrides: Partial<Parameters<typeof BriefingDayTimeline>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(BriefingDayTimeline, {
      planId: 'plan-1',
      day: 1,
      kind: 'TODAY',
      plan: { items, lodgingBasis: null },
      representativePlaceId: 'P1',
      representativePlaceTitle: '중문색달해수욕장',
      ...overrides,
    }),
  )
}

describe('BriefingDayTimeline (#1415)', () => {
  it('그날 항목 전부가 한 행씩 선다 — 사이 N곳 접기가 없다', () => {
    const markup = render()
    expect(markup.match(/<li\b/g)).toHaveLength(4)
    expect(markup).not.toContain('사이 ')
  })
  it('개수 줄은 상세에서 센다', () => {
    expect(render()).toContain(
      messages.plan.briefingScheduleCounts.replace('{count}', '4').replace('{visited}', '1'),
    )
  })
  it('번호는 동선 순번 — 좌표 있는 항목만 1, 2 … 이동 · 좌표 없음은 번호가 없다', () => {
    const markup = render()
    expect(markup.match(/data-route-order="\d+"/g)).toEqual([
      'data-route-order="1"',
      'data-route-order="2"',
    ])
  })
  it('좌표 없는 장소 수를 알린다 — 이동은 세지 않는다', () => {
    expect(render()).toContain(messages.map.routeOmitted.replace('{n}', '1'))
  })
  it('기준 배지는 targetId 가 맞는 첫 행에만', () => {
    const markup = render()
    expect(markup.match(new RegExp(messages.plan.briefingScheduleBasisTag, 'g'))).toHaveLength(1)
    expect(markup.indexOf(messages.plan.briefingScheduleBasisTag)).toBeLessThan(
      markup.indexOf('식당'),
    )
  })
  it('기준 장소가 그날 항목에 없으면 기준 한 줄로 남는다', () => {
    const markup = render({
      representativePlaceId: 'ELSEWHERE',
      representativePlaceTitle: '다른곳',
    })
    expect(markup).toContain(messages.plan.briefingScheduleBasisPlace.replace('{title}', '다른곳'))
  })
  it('기준이 식사 행이면 그 행에 배지가 붙고 기준 한 줄은 없다', () => {
    const meal = planItem({
      planItemId: 'meal',
      day: 1,
      sequence: 4,
      itemType: { code: 'MEAL', name: '식사', description: null },
      targetId: 'P7',
      title: '흑돼지집',
    })
    const markup = render({
      plan: { items: [...items, meal], lodgingBasis: null },
      representativePlaceId: 'P7',
      representativePlaceTitle: '흑돼지집',
    })
    expect(markup.match(new RegExp(messages.plan.briefingScheduleBasisTag, 'g'))).toHaveLength(1)
    expect(markup.indexOf(messages.plan.briefingScheduleBasisTag)).toBeGreaterThan(
      markup.indexOf('메모장소'),
    )
    expect(markup).not.toContain(messages.plan.briefingScheduleBasisPlace.replace('{title}', ''))
  })
  it('다녀온 행은 흐리고 다녀옴 배지가 붙는다', () => {
    const markup = render()
    expect(markup).toContain(messages.plan.briefingScheduleVisited)
    expect(markup).toMatch(/data-visited="true"[^>]*class="[^"]*text-fg-muted/)
  })
  it('시각이 있으면 HH:mm, 없으면 빈 칸', () => {
    const markup = render()
    expect(markup).toContain('10:05')
    expect(markup).not.toContain('10:05:00')
  })
  it('행은 링크가 아니다 — 링크는 길찾기 · 이 날 일정 보기 둘뿐', () => {
    const markup = render()
    expect(markup.match(/<a\b/g)).toHaveLength(2)
  })
  it('오늘 길찾기는 아직 안 간 첫 장소 — 다녀온 식당이 아니다', () => {
    const markup = render({
      kind: 'TODAY',
      plan: {
        items: [
          { ...items[0]!, visited: true },
          { ...items[1]!, visited: false },
        ],
        lodgingBasis: null,
      },
    })
    expect(markup).toContain(messages.plan.briefingScheduleDirections.replace('{title}', '식당'))
  })
  it('좌표 있는 항목이 없으면 길찾기가 없고 목록 · 이 날 일정 보기는 남는다', () => {
    const markup = render({
      plan: { items: [items[2]!, items[3]!], lodgingBasis: null },
    })
    expect(markup).not.toContain('map.kakao.com/link/to')
    expect(markup).toContain(messages.plan.briefingScheduleOpenDay)
    expect(markup.match(/<li\b/g)).toHaveLength(2)
  })
  it('항목이 없으면 빈 상태와 담기 링크', () => {
    const markup = render({ plan: { items: [], lodgingBasis: null } })
    expect(markup).toContain(messages.plan.briefingScheduleEmptyTitle)
    expect(markup).toContain('/plans/plan-1/days/1/add')
    expect(markup).not.toContain('<ol')
  })
  it('h2 를 더하지 않는다', () => {
    expect(render()).not.toContain('<h2')
  })
})
