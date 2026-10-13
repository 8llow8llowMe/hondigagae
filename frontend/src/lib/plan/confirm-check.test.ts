import { describe, expect, it } from 'vitest'

import { planConfirmCheck } from '@/lib/plan/confirm-check'
import { planItem } from '@/test/fixtures/plan'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 확정 전 점검 — 이슈 #1425 · 명세 D26-1.
 *
 * 재현(2026-10-13 dev): 시각이 겹친 일정, 식사가 0건인 날이 있는 일정이 경고 없이 확정됐다.
 */

const TYPE_NAMES: Record<string, string> = {
  PLACE: '장소',
  MEAL: '식사',
  LODGING: '숙박',
  WALK: '산책',
  MOVE: '이동',
}

let nextId = 0

function item(
  day: number,
  code: string,
  startTime: string | null,
  title = `${code}-${String(nextId)}`,
): PlanItemDetail {
  nextId += 1
  return planItem({
    planItemId: `item-${String(nextId)}`,
    day,
    sequence: nextId,
    itemType: { code, name: TYPE_NAMES[code] ?? code, description: null },
    title,
    startTime,
  })
}

describe('planConfirmCheck — 문제가 없으면 빈 배열이다', () => {
  it('시각이 순서대로 흐르고 식사가 있는 날은 문제가 없다', () => {
    const days = [
      {
        day: 1,
        items: [
          item(1, 'PLACE', '10:00:00'),
          item(1, 'MEAL', '12:30:00'),
          item(1, 'LODGING', '15:00:00'),
        ],
      },
    ]

    expect(planConfirmCheck(days)).toEqual([])
  })

  it('빈 날은 식사를 묻지 않는다 — 아직 짜지 않은 날이다 (직접 만든 빈 초안이 바로 확정된다)', () => {
    expect(
      planConfirmCheck([
        { day: 1, items: [] },
        { day: 2, items: [] },
      ]),
    ).toEqual([])
  })

  it('숙박 · 이동만 있는 날은 식사를 묻지 않는다 — 저녁에 도착해 숙소만 담은 날이다', () => {
    const days = [{ day: 1, items: [item(1, 'MOVE', '18:00:00'), item(1, 'LODGING', '19:00:00')] }]

    expect(planConfirmCheck(days)).toEqual([])
  })

  it('시각이 빈 MOVE 는 문제가 아니다 — 이동·휴식 추가는 시각을 받지 않는다', () => {
    const days = [
      {
        day: 1,
        items: [item(1, 'PLACE', '10:00:00'), item(1, 'MOVE', null), item(1, 'MEAL', '12:00:00')],
      },
    ]

    expect(planConfirmCheck(days)).toEqual([])
  })
})

describe('planConfirmCheck — 시각 역행 · 겹침은 D25-4 판정 그대로다', () => {
  it('사용성 테스트 재현 — 12:30 은 역행, 마지막 15:00 은 겹침이다', () => {
    const late = item(1, 'MEAL', '12:30:00', '흑돼지 거리')
    const lodging = item(1, 'LODGING', '15:00:00', '애월 펜션')
    const days = [
      {
        day: 1,
        items: [item(1, 'PLACE', '10:00:00'), item(1, 'PLACE', '15:00:00'), late, lodging],
      },
    ]

    expect(planConfirmCheck(days)).toEqual([
      {
        day: 1,
        issues: [
          { kind: 'backward', planItemId: late.planItemId, title: '흑돼지 거리', time: '12:30' },
          { kind: 'overlap', planItemId: lodging.planItemId, title: '애월 펜션', time: '15:00' },
        ],
      },
    ])
  })

  it('시각이 있는 MOVE 의 겹침은 다른 항목처럼 본다', () => {
    const second = item(1, 'MOVE', '10:00:00', '이동 및 휴식')
    const days = [
      { day: 1, items: [item(1, 'MOVE', '10:00:00'), second, item(1, 'LODGING', '15:00:00')] },
    ]

    expect(planConfirmCheck(days)).toEqual([
      {
        day: 1,
        issues: [
          { kind: 'overlap', planItemId: second.planItemId, title: '이동 및 휴식', time: '10:00' },
        ],
      },
    ])
  })
})

describe('planConfirmCheck — 시각이 빈 항목', () => {
  it('시각이 없거나 형식이 어긋난 항목을 그 순서대로 말한다', () => {
    const blank = item(1, 'PLACE', null, '협재해수욕장')
    const broken = item(1, 'LODGING', '오후 3시', '애월 펜션')
    const days = [{ day: 1, items: [item(1, 'MEAL', '12:00:00'), blank, broken] }]

    expect(planConfirmCheck(days)).toEqual([
      {
        day: 1,
        issues: [
          { kind: 'no-time', planItemId: blank.planItemId, title: '협재해수욕장' },
          { kind: 'no-time', planItemId: broken.planItemId, title: '애월 펜션' },
        ],
      },
    ])
  })
})

describe('planConfirmCheck — 식사가 없는 날', () => {
  it('장소 · 산책이 있는데 MEAL 이 없으면 그날 끝에 식사를 말한다', () => {
    const days = [{ day: 1, items: [item(1, 'PLACE', '10:00:00'), item(1, 'WALK', '13:00:00')] }]

    expect(planConfirmCheck(days)).toEqual([{ day: 1, issues: [{ kind: 'no-meal' }] }])
  })

  it('식사는 itemType.code 로만 가른다 — 한국어 name 이 식사여도 code 가 PLACE 면 세지 않는다', () => {
    const restaurantAsPlace = planItem({
      planItemId: 'restaurant',
      day: 1,
      sequence: 0,
      itemType: { code: 'PLACE', name: '식사', description: null },
      startTime: '12:00:00',
    })

    expect(planConfirmCheck([{ day: 1, items: [restaurantAsPlace] }])).toEqual([
      { day: 1, issues: [{ kind: 'no-meal' }] },
    ])
  })

  it('한 일자 안에서는 시각 문제가 먼저, 식사가 마지막이다', () => {
    const blank = item(2, 'PLACE', null, '성산일출봉')
    const days = [
      { day: 1, items: [item(1, 'MEAL', '12:00:00')] },
      { day: 2, items: [blank, item(2, 'PLACE', '14:00:00')] },
    ]

    expect(planConfirmCheck(days)).toEqual([
      {
        day: 2,
        issues: [
          { kind: 'no-time', planItemId: blank.planItemId, title: '성산일출봉' },
          { kind: 'no-meal' },
        ],
      },
    ])
  })
})

describe('planConfirmCheck — 일자', () => {
  it('문제가 있는 일자만 일자 오름차순으로 돌려준다', () => {
    const days = [
      { day: 3, items: [item(3, 'PLACE', '10:00:00')] },
      { day: 1, items: [item(1, 'PLACE', '10:00:00')] },
      { day: 2, items: [item(2, 'MEAL', '12:00:00')] },
    ]

    expect(planConfirmCheck(days).map((entry) => entry.day)).toEqual([1, 3])
  })
})
