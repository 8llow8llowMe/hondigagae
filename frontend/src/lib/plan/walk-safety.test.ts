import { describe, expect, it } from 'vitest'

import {
  dayBeyondForecastReason,
  dayHasLookupFailed,
  itemWalkSafetyView,
  walkSafetyByItemId,
} from '@/lib/plan/walk-safety'
import { planItemWalkSafety } from '@/test/fixtures/plan'

/**
 * 항목 산책 위험도 순수 로직 — 이슈 #625 · 명세 D15-9.
 *
 * **jsdom 없이 값으로 검증한다** — 이 판정 로직은 렌더가 아니라 계약 해석이라
 * 문자열 assertion 이 아니라 값으로 검증해야 한다.
 */

describe('walkSafetyByItemId()', () => {
  it('planItemId 로 항목을 잇는다', () => {
    const item = planItemWalkSafety({ planItemId: 'i-1' })
    const map = walkSafetyByItemId([item])

    expect(map.get('i-1')).toBe(item)
  })

  it('없는 id 는 undefined 다', () => {
    const map = walkSafetyByItemId([planItemWalkSafety({ planItemId: 'i-1' })])

    expect(map.get('i-999')).toBeUndefined()
  })
})

describe('itemWalkSafetyView()', () => {
  it('SAFE/CAUTION/DANGER 는 배지다', () => {
    for (const code of ['SAFE', 'CAUTION', 'DANGER'] as const) {
      const item = planItemWalkSafety({
        planItemId: 'i-1',
        unavailableReasonCode: null,
        unavailableReason: null,
        walkSafetyLevel: { code, name: code, description: null, scoreDescription: null },
      })

      expect(itemWalkSafetyView(item)).toEqual({
        kind: 'badge',
        tone: expect.any(String),
        label: code,
      })
    }
  })

  it('walkSafetyLevel 이 null 이고 NO_START_TIME 이면 hidden 이다', () => {
    const item = planItemWalkSafety({
      planItemId: 'i-1',
      startTime: null,
      walkSafetyLevel: null,
      unavailableReasonCode: 'NO_START_TIME',
      unavailableReason: '시작 시각이 없어 판정할 수 없습니다.',
    })

    expect(itemWalkSafetyView(item)).toEqual({ kind: 'hidden' })
  })

  it('NOT_PLACE_TARGET · PAST_DATE 도 hidden 이다', () => {
    for (const code of ['NOT_PLACE_TARGET', 'PAST_DATE']) {
      const item = planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: null,
        unavailableReasonCode: code,
        unavailableReason: '서버 문장',
      })

      expect(itemWalkSafetyView(item)).toEqual({ kind: 'hidden' })
    }
  })

  it('LOOKUP_FAILED 는 retriable 이고 서버 문장을 그대로 낸다', () => {
    const item = planItemWalkSafety({
      planItemId: 'i-1',
      walkSafetyLevel: null,
      unavailableReasonCode: 'LOOKUP_FAILED',
      unavailableReason: '산책 위험도를 조회하지 못했습니다.',
    })

    expect(itemWalkSafetyView(item)).toEqual({
      kind: 'retriable',
      text: '산책 위험도를 조회하지 못했습니다.',
    })
  })

  it('모르는 사유 코드는 sentence — 서버 문장 그대로다', () => {
    const item = planItemWalkSafety({
      planItemId: 'i-1',
      walkSafetyLevel: null,
      unavailableReasonCode: 'SOMETHING_NEW',
      unavailableReason: '새로 생긴 사유입니다.',
    })

    expect(itemWalkSafetyView(item)).toEqual({ kind: 'sentence', text: '새로 생긴 사유입니다.' })
  })

  it('등급 UNKNOWN 이고 사유 코드가 null 이면 description 문장을 낸다', () => {
    const item = planItemWalkSafety({
      planItemId: 'i-1',
      unavailableReasonCode: null,
      unavailableReason: null,
      walkSafetyLevel: {
        code: 'UNKNOWN',
        name: '판단 근거 부족',
        description: '이 시각의 예보 자료가 부족해 등급을 매기지 못했습니다.',
        scoreDescription: null,
      },
    })

    expect(itemWalkSafetyView(item)).toEqual({
      kind: 'sentence',
      text: '이 시각의 예보 자료가 부족해 등급을 매기지 못했습니다.',
    })
  })

  it('모르는 등급 코드는 배지를 세우고 name 을 그대로 쓰며 unknown 톤이다', () => {
    const item = planItemWalkSafety({
      planItemId: 'i-1',
      unavailableReasonCode: null,
      unavailableReason: null,
      walkSafetyLevel: {
        code: 'SCORCHING',
        name: '폭염',
        description: null,
        scoreDescription: null,
      },
    })

    expect(itemWalkSafetyView(item)).toEqual({ kind: 'badge', tone: 'unknown', label: '폭염' })
  })
})

describe('dayBeyondForecastReason()', () => {
  it('그 일자 항목이 전부 BEYOND_FORECAST_RANGE 면 문장 하나를 낸다', () => {
    const items = [
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: null,
        unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
        unavailableReason: '예보 범위를 벗어났습니다.',
      }),
      planItemWalkSafety({
        planItemId: 'i-2',
        walkSafetyLevel: null,
        unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
        unavailableReason: '예보 범위를 벗어났습니다.',
      }),
    ]

    expect(dayBeyondForecastReason(items)).toBe('예보 범위를 벗어났습니다.')
  })

  it('항목이 0개인 일자는 null 이다 — 빈 일차 안내가 이미 말한다', () => {
    expect(dayBeyondForecastReason([])).toBeNull()
  })

  it('사유가 섞여 있으면 null 이다 — 일자 단위로 접지 않는다', () => {
    const items = [
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: null,
        unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
        unavailableReason: '예보 범위를 벗어났습니다.',
      }),
      planItemWalkSafety({
        planItemId: 'i-2',
        unavailableReasonCode: null,
        unavailableReason: null,
        walkSafetyLevel: { code: 'SAFE', name: '안전', description: null, scoreDescription: null },
      }),
    ]

    expect(dayBeyondForecastReason(items)).toBeNull()
  })
})

describe('dayHasLookupFailed()', () => {
  it('하나라도 LOOKUP_FAILED 면 true 다', () => {
    const items = [
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: null,
        unavailableReasonCode: 'LOOKUP_FAILED',
        unavailableReason: '조회하지 못했습니다.',
      }),
    ]

    expect(dayHasLookupFailed(items)).toBe(true)
  })

  it('없으면 false 다', () => {
    expect(dayHasLookupFailed([planItemWalkSafety({ planItemId: 'i-1' })])).toBe(false)
  })
})
