import { describe, expect, it } from 'vitest'

import { planForecastNotice } from '@/lib/plan/forecast-notice'
import { planVerdict } from '@/test/fixtures/plan'
import type { PlanDayWeatherItem } from '@/types/plan'

/** 서버 enum 문장 그대로 — 줄여 적으면 화면이 실제로 받는 문장이 아닌 것으로 검증하게 된다 */
const VERDICT_BEYOND = '예보는 오늘부터 11일까지만 제공되어 이 날짜는 아직 알려 드릴 수 없습니다.'
const WALK_BEYOND =
  '산책 위험도는 시각별 예보로만 안내할 수 있고, 그 예보는 오늘부터 5일까지입니다. 이 날짜는 아직 알려 드릴 수 없습니다.'

function beyond(day: number): PlanDayWeatherItem {
  return {
    ...planVerdict,
    day,
    score: null,
    suitabilityLevel: null,
    unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
    unavailableReason: VERDICT_BEYOND,
  }
}

function judged(day: number): PlanDayWeatherItem {
  return { ...planVerdict, day }
}

describe('planForecastNotice — 예보 전 안내는 일정에 한 번 (#1426)', () => {
  it('세 날이 다 예보 밖이어도 문장은 두 개뿐이다 — 판정 하나 · 산책 위험도 하나', () => {
    const notice = planForecastNotice({
      verdicts: [beyond(1), beyond(2), beyond(3)],
      walkBeyondByDay: new Map([
        [1, WALK_BEYOND],
        [2, WALK_BEYOND],
        [3, WALK_BEYOND],
      ]),
    })

    expect(notice?.sentences).toEqual([VERDICT_BEYOND, WALK_BEYOND])
    expect([...(notice?.pendingByDay ?? new Map())]).toEqual([
      [1, 'all'],
      [2, 'all'],
      [3, 'all'],
    ])
  })

  it('판정은 났는데 산책 위험도만 예보 밖이면 그 날은 `walk` 다', () => {
    const notice = planForecastNotice({
      verdicts: [judged(1), beyond(2)],
      walkBeyondByDay: new Map([
        [1, WALK_BEYOND],
        [2, WALK_BEYOND],
      ]),
    })

    expect(notice?.pendingByDay.get(1)).toBe('walk')
    expect(notice?.pendingByDay.get(2)).toBe('all')
  })

  it('예보 밖인 날이 없으면 null — 안내도 칩도 없다', () => {
    expect(
      planForecastNotice({
        verdicts: [judged(1), judged(2)],
        walkBeyondByDay: new Map([
          [1, null],
          [2, null],
        ]),
      }),
    ).toBeNull()
  })

  it('다른 사유(지난 날 · 장소 없음)는 끌어올리지 않는다 — 날마다 갈리는 사실이다', () => {
    const past: PlanDayWeatherItem = {
      ...beyond(1),
      unavailableReasonCode: 'PAST_DATE',
      unavailableReason: '이미 지난 날짜라 예보가 남아 있지 않습니다.',
    }

    expect(planForecastNotice({ verdicts: [past], walkBeyondByDay: new Map() })).toBeNull()
  })

  it('판정 쪽 문장이 비어 와도 산책 문장만으로 선다', () => {
    const notice = planForecastNotice({
      verdicts: [{ ...beyond(1), unavailableReason: null }],
      walkBeyondByDay: new Map([[1, WALK_BEYOND]]),
    })

    expect(notice?.sentences).toEqual([WALK_BEYOND])
  })

  it('코드만 오고 문장이 하나도 없으면 null — 이유 없는 칩을 세우지 않는다', () => {
    expect(
      planForecastNotice({
        verdicts: [{ ...beyond(1), unavailableReason: null }],
        walkBeyondByDay: new Map([[1, null]]),
      }),
    ).toBeNull()
  })
})
