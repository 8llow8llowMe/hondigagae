import { describe, expect, it } from 'vitest'

import {
  dayBeyondForecastReason,
  dayHasLookupFailed,
  itemWalkSafetyView,
  NO_FORECAST_AT_TIME_CODE,
  walkSafetyByItemId,
} from '@/lib/plan/walk-safety'
import { planItemWalkSafety } from '@/test/fixtures/plan'

/**
 * 항목 산책 위험도 순수 로직 — 이슈 #625 · 명세 D15-9.
 *
 * **jsdom 없이 값으로 검증한다** — 이 판정 로직은 렌더가 아니라 계약 해석이라
 * 문자열 assertion 이 아니라 값으로 검증해야 한다.
 */

/** 서버가 그 시각 예보를 쓸 수 없을 때 내리는 문장 (#717). 원인을 단정하지 않는다 */
const NO_FORECAST_SENTENCE = '이 시각의 예보를 쓸 수 없어 산책 위험도를 내지 못했습니다.'

/**
 * `NO_FORECAST_AT_TIME` 줄 — **사유 코드와 등급이 함께 온다** (#717).
 *
 * 옛 불변식(`사유 있음 → 판정 통째로 null`)의 유일한 예외라, 픽스처도 그 모양이어야
 * 테스트가 실제 응답을 대신한다. tour 에 물어서 받은 답이므로 `placeTitle`·`basisPetId`·
 * `petConditionApplied` 도 남는다.
 */
function noForecastAtTime(planItemId: string) {
  return planItemWalkSafety({
    planItemId,
    unavailableReasonCode: NO_FORECAST_AT_TIME_CODE,
    unavailableReason: NO_FORECAST_SENTENCE,
    walkSafetyLevel: {
      code: 'UNKNOWN',
      name: '판단 근거 부족',
      description: '예보가 없어 위험도를 판단하지 않았습니다.',
      scoreDescription: '예보 범위 밖이거나 날씨 정보를 가져오지 못했습니다.',
    },
    estimatedPavementCelsius: null,
    feelsLikeCelsius: null,
    temperature: null,
  })
}

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

  /*
    **여섯째 사유가 `sentence` 인 것은 의도다** (#717). 지금은 "모르는 코드" 갈래로 떨어져
    저절로 맞게 도는데, 그것이 우연이 아니라 결정이었음을 여기서 고정한다 — 나중에 누가
    `HIDDEN_REASON_CODES` 에 넣거나 일자 단위로 접으면 이 테스트가 먼저 깨진다.
  */
  it('NO_FORECAST_AT_TIME 은 sentence 다 — 숨기지도 재시도도 아니다', () => {
    const view = itemWalkSafetyView(noForecastAtTime('i-1'))

    expect(view).toEqual({ kind: 'sentence', text: NO_FORECAST_SENTENCE })
    expect(view.kind).not.toBe('hidden')
    expect(view.kind).not.toBe('retriable')
  })

  it('사유 코드와 walkSafetyLevel 이 함께 와도 사유 문장이 이긴다 (#717 불변식 예외)', () => {
    const item = noForecastAtTime('i-1')

    // 옛 불변식(`사유 있음 → 판정 null`)이 깨진 줄이다. 등급이 함께 와도 배지를 세우지 않는다
    expect(item.walkSafetyLevel).not.toBeNull()
    expect(itemWalkSafetyView(item)).toEqual({ kind: 'sentence', text: NO_FORECAST_SENTENCE })
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

  /*
    **NO_FORECAST_AT_TIME 은 일자로 접히지 않는다** (#717). 항목마다 갈리는 사유라
    접으면 판정이 난 항목까지 "이 날은 판정할 수 없다" 로 덮어 거짓이 된다.
  */
  it('NO_FORECAST_AT_TIME 만 있는 날도 null 이다 — 항목마다 갈리는 사유라 접지 않는다', () => {
    const items = [noForecastAtTime('i-1'), noForecastAtTime('i-2')]

    expect(dayBeyondForecastReason(items)).toBeNull()
  })

  it('BEYOND_FORECAST_RANGE 에 NO_FORECAST_AT_TIME 이 섞이면 null 이다 — 둘은 다른 사실이다', () => {
    const items = [
      planItemWalkSafety({
        planItemId: 'i-1',
        walkSafetyLevel: null,
        unavailableReasonCode: 'BEYOND_FORECAST_RANGE',
        unavailableReason: '예보 범위를 벗어났습니다.',
      }),
      noForecastAtTime('i-2'),
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

  /*
    **NO_FORECAST_AT_TIME 은 재시도 버튼을 세우지 않는다** (#717). 그 사유에도 기상 원천
    장애가 섞여 들어오지만 BE 가 이 경계에서 "지금 그 시각 예보가 없다" 와 "원천이 잠깐
    죽었다" 를 가르지 못한다 — 눌러도 같은 답이 오는 버튼은 사용자가 차이를 알 수 없다.
  */
  it('NO_FORECAST_AT_TIME 만 있으면 false 다 — 눌러도 같은 답이 오는 버튼을 세우지 않는다', () => {
    expect(dayHasLookupFailed([noForecastAtTime('i-1'), noForecastAtTime('i-2')])).toBe(false)
  })
})
