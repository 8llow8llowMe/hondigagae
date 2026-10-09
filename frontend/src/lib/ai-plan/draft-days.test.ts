import { describe, expect, it } from 'vitest'

import { draftDayCoverage, isVisitDay } from '@/lib/ai-plan/draft-days'
import { aiPlanDraft, aiPlanItem } from '@/test/fixtures/ai-plan'

const PLACE = aiPlanItem({ itemType: 'PLACE' })
const MEAL = aiPlanItem({ itemType: 'MEAL', placeId: '2' })
const LODGING = aiPlanItem({ itemType: 'LODGING', placeId: '3' })

describe('isVisitDay — 방문 항목이 있는 날 (#1270 · 백엔드 #1268 hasVisitItem)', () => {
  it('장소나 식사가 하나라도 있으면 만든 날이다', () => {
    expect(isVisitDay({ day: 1, items: [PLACE] })).toBe(true)
    expect(isVisitDay({ day: 1, items: [MEAL, LODGING] })).toBe(true)
  })

  /** dev job `e0f1fd25…` — 세 날 모두 `items: []` 로 왔다 */
  it('항목이 없는 날은 빈 날이다', () => {
    expect(isVisitDay({ day: 1, items: [] })).toBe(false)
  })

  /** 숙소만 있는 날은 일정이 아니다 — 서버도 같은 기준으로 빈 초안을 가른다 */
  it('숙소만 있는 날은 빈 날이다', () => {
    expect(isVisitDay({ day: 1, items: [LODGING] })).toBe(false)
    expect(isVisitDay({ day: 1, items: [LODGING, LODGING] })).toBe(false)
  })
})

describe('draftDayCoverage — 만든 날을 센다 (#1270)', () => {
  it('모든 날에 방문 항목이 있으면 빈 날이 없다', () => {
    const coverage = draftDayCoverage(
      aiPlanDraft([
        { day: 1, items: [PLACE] },
        { day: 2, items: [MEAL] },
      ]),
      2,
    )

    expect(coverage).toEqual({ made: 2, total: 2, partial: false })
  })

  /*
    **`days.length` 로 세지 않는다.** 예전에는 그래서 세 날 모두 빈 초안이 "3일 중 3일" 로
    읽혀 빈 상태로 가지 않고 제목뿐인 카드 셋이 섰다.
  */
  it('모든 날이 비면 만든 날이 0이다 — days.length 가 아니다', () => {
    const coverage = draftDayCoverage(
      aiPlanDraft([
        { day: 1, items: [] },
        { day: 2, items: [LODGING] },
        { day: 3, items: [] },
      ]),
      3,
    )

    expect(coverage).toEqual({ made: 0, total: 3, partial: false })
  })

  it('일부만 비면 부분 생성이다', () => {
    const coverage = draftDayCoverage(
      aiPlanDraft([
        { day: 1, items: [PLACE] },
        { day: 2, items: [LODGING] },
        { day: 3, items: [MEAL] },
      ]),
      3,
    )

    expect(coverage).toEqual({ made: 2, total: 3, partial: true })
  })

  /** 응답에서 빠진 날도 만들지 못한 날이다 — 서버의 빈 날 경고도 그날을 센다 */
  it('응답에 없는 날도 부분 생성으로 센다', () => {
    const coverage = draftDayCoverage(aiPlanDraft([{ day: 1, items: [PLACE] }]), 3)

    expect(coverage).toEqual({ made: 1, total: 3, partial: true })
  })

  /*
    **기간을 모르면 단정하지 않는다** (명세 S6). "N일 중" 의 N 을 지어내지 않는다 —
    `days.length` 는 응답이 빠뜨린 날을 모른다. 빈 날 카드는 카드가 `isVisitDay` 로 짚는다.
  */
  it('기간을 모르면 부분 생성이라 말하지 않는다', () => {
    const coverage = draftDayCoverage(
      aiPlanDraft([
        { day: 1, items: [PLACE] },
        { day: 2, items: [] },
      ]),
      null,
    )

    expect(coverage).toEqual({ made: 1, total: null, partial: false })
  })

  /** 담기가 기간 밖 일차를 버린다(`toDraftItems`) — 그날을 만든 날로 세면 수가 부푼다 */
  it('기간 밖 일차는 만든 날로 세지 않는다', () => {
    const coverage = draftDayCoverage(
      aiPlanDraft([
        { day: 1, items: [PLACE] },
        { day: 4, items: [PLACE] },
      ]),
      3,
    )

    expect(coverage.made).toBe(1)
  })

  it('같은 일차가 두 번 와도 한 날로 센다', () => {
    const coverage = draftDayCoverage(
      aiPlanDraft([
        { day: 1, items: [PLACE] },
        { day: 1, items: [MEAL] },
      ]),
      2,
    )

    expect(coverage.made).toBe(1)
  })
})
