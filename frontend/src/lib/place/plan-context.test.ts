import { describe, expect, it } from 'vitest'

import {
  basisPetOf,
  parsePlanContext,
  pickTripCongestions,
  placeHrefFromPlan,
  type PlanBasisState,
  planBasisState,
  resolvePlanBasis,
  shortDateLabel,
  tripOfBasis,
  weatherBasisPetIdOf,
} from '@/lib/place/plan-context'
import { congestion } from '@/test/fixtures/insight'
import { pet, planDetail, secondPet } from '@/test/fixtures/plan'
import type { PlanDetail } from '@/types/plan'

/**
 * 장소 상세 — 일정에서 들어왔을 때의 기준 (#1429 · 장소상세-세부명세 D1-5).
 */

const params = (query: string) => new URLSearchParams(query)

/** 픽스처 여행(2026-09-12 ~ 14)의 첫날 — 모든 일차가 오늘이거나 앞날이다 */
const TODAY = '2026-09-12'

const twoPetPlan: PlanDetail = {
  ...planDetail,
  petId: pet.petId,
  petIds: [pet.petId, secondPet.petId],
}

describe('parsePlanContext', () => {
  it('plan 과 day 가 둘 다 바르면 읽는다', () => {
    expect(parsePlanContext(params('plan=223456789012000001&day=2'))).toEqual({
      planId: '223456789012000001',
      day: 2,
    })
  })

  it('하나라도 없으면 null 이다 — 지금 동작으로 돌아간다', () => {
    expect(parsePlanContext(params(''))).toBeNull()
    expect(parsePlanContext(params('plan=1'))).toBeNull()
    expect(parsePlanContext(params('day=1'))).toBeNull()
  })

  it('planId 가 숫자가 아니면 null 이다 — 400 이 정해진 요청을 보내지 않는다', () => {
    expect(parsePlanContext(params('plan=abc&day=1'))).toBeNull()
    expect(parsePlanContext(params('plan=-1&day=1'))).toBeNull()
  })

  it('day 는 1 이상의 정수만 받는다', () => {
    expect(parsePlanContext(params('plan=1&day=0'))).toBeNull()
    expect(parsePlanContext(params('plan=1&day=-1'))).toBeNull()
    expect(parsePlanContext(params('plan=1&day=1.5'))).toBeNull()
    expect(parsePlanContext(params('plan=1&day=01'))).toBeNull()
    expect(parsePlanContext(params('plan=1&day=x'))).toBeNull()
  })
})

describe('placeHrefFromPlan', () => {
  it('일정과 일차를 쿼리로 싣는다', () => {
    expect(placeHrefFromPlan('77', { planId: '9', day: 3 })).toBe('/places/77?plan=9&day=3')
  })

  it('맥락이 없으면 맨 상세 주소다', () => {
    expect(placeHrefFromPlan('77', null)).toBe('/places/77')
  })

  it('만든 주소를 다시 읽으면 같은 맥락이다 (round-trip)', () => {
    const href = placeHrefFromPlan('77', { planId: '223456789012000001', day: 2 })
    const query = href.slice(href.indexOf('?') + 1)
    expect(parsePlanContext(params(query))).toEqual({ planId: '223456789012000001', day: 2 })
  })
})

describe('resolvePlanBasis — 날짜', () => {
  it('일차를 여행 시작일에서 센다', () => {
    const basis = resolvePlanBasis({
      plan: planDetail,
      day: 2,
      basisPetId: null,
      pets: [pet],
      today: TODAY,
    })
    expect(basis?.date).toBe('2026-09-13')
  })

  it('여행 날짜 전체를 함께 준다', () => {
    const basis = resolvePlanBasis({
      plan: planDetail,
      day: 1,
      basisPetId: null,
      pets: [pet],
      today: TODAY,
    })
    expect(basis?.tripDates).toEqual(['2026-09-12', '2026-09-13', '2026-09-14'])
  })

  it('일차가 여행 기간을 넘으면 null 이다 — 없는 날을 판정하지 않는다', () => {
    expect(
      resolvePlanBasis({ plan: planDetail, day: 4, basisPetId: null, pets: [pet], today: TODAY }),
    ).toBeNull()
  })

  it('기간을 못 읽으면 null 이다', () => {
    const broken = { ...planDetail, startDate: 'x' }
    expect(
      resolvePlanBasis({ plan: broken, day: 1, basisPetId: null, pets: [pet], today: TODAY }),
    ).toBeNull()
  })
})

describe('resolvePlanBasis — 반려견', () => {
  it('그날 판정의 기준견(basisPetId)을 고른다', () => {
    const basis = resolvePlanBasis({
      plan: twoPetPlan,
      day: 1,
      basisPetId: secondPet.petId,
      pets: [pet, secondPet],
      today: TODAY,
    })
    expect(basis?.pet.petId).toBe(secondPet.petId)
  })

  it('기준견이 없으면 대표 반려견(petIds[0])이다', () => {
    const basis = resolvePlanBasis({
      plan: twoPetPlan,
      day: 1,
      basisPetId: null,
      pets: [secondPet, pet],
      today: TODAY,
    })
    expect(basis?.pet.petId).toBe(pet.petId)
  })

  it('기준견이 이 일정의 동행이 아니면 무시한다', () => {
    const basis = resolvePlanBasis({
      plan: planDetail,
      day: 1,
      basisPetId: secondPet.petId,
      pets: [pet, secondPet],
      today: TODAY,
    })
    expect(basis?.pet.petId).toBe(pet.petId)
  })

  it('대표가 내 목록에 없으면 다음 동행을 쓴다', () => {
    const basis = resolvePlanBasis({
      plan: twoPetPlan,
      day: 1,
      basisPetId: null,
      pets: [secondPet],
      today: TODAY,
    })
    expect(basis?.pet.petId).toBe(secondPet.petId)
  })

  it('동행 반려견을 하나도 못 찾으면 null 이다', () => {
    expect(
      resolvePlanBasis({ plan: planDetail, day: 1, basisPetId: null, pets: [], today: TODAY }),
    ).toBeNull()
  })
})

describe('shortDateLabel', () => {
  it('앞자리 0 없이 월/일이다', () => {
    expect(shortDateLabel('2026-11-06')).toBe('11/6')
    expect(shortDateLabel('2026-09-13T14:00:00')).toBe('9/13')
  })

  it('못 읽으면 null 이다', () => {
    expect(shortDateLabel('x')).toBeNull()
  })
})

describe('pickTripCongestions', () => {
  it('받아 둔 날짜별 혼잡도에서 여행일만 고른다 — 순서는 여행일 순이다', () => {
    const picked = pickTripCongestions(congestion.dailyCongestions, [
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
    ])
    expect(picked.map((item) => item.date)).toEqual(['2026-09-06', '2026-09-07'])
  })

  it('겹치는 날이 없으면 빈 배열이다', () => {
    expect(pickTripCongestions(congestion.dailyCongestions, ['2026-11-06'])).toEqual([])
  })
})

describe('planBasisState', () => {
  const context = { planId: planDetail.planId, day: 1 }
  const ok = <T>(data: T) => ({ data, pending: false, failed: false })
  const pending = { data: undefined, pending: true, failed: false }
  const failed = { data: undefined, pending: false, failed: true }

  it('맥락이 없으면 none 이다', () => {
    expect(
      planBasisState({
        context: null,
        plan: pending,
        weatherBasisPetId: undefined,
        pets: pending,
        today: TODAY,
      }),
    ).toEqual({ status: 'none' })
  })

  it('일정을 못 읽으면 none 이다 — 남의 일정 · 지운 일정', () => {
    expect(
      planBasisState({
        context,
        plan: failed,
        weatherBasisPetId: null,
        pets: ok([pet]),
        today: TODAY,
      }),
    ).toEqual({ status: 'none' })
  })

  it('반려견 목록을 못 읽으면 none 이다', () => {
    expect(
      planBasisState({
        context,
        plan: ok(planDetail),
        weatherBasisPetId: null,
        pets: failed,
        today: TODAY,
      }),
    ).toEqual({ status: 'none' })
  })

  it('일정 판정을 기다린다 — 기준견이 바뀌며 판정이 뒤바뀌지 않게', () => {
    expect(
      planBasisState({
        context,
        plan: ok(planDetail),
        weatherBasisPetId: undefined,
        pets: ok([pet]),
        today: TODAY,
      }),
    ).toEqual({ status: 'pending' })
  })

  it('다 모이면 ready 다', () => {
    const state = planBasisState({
      context,
      plan: ok(planDetail),
      weatherBasisPetId: null,
      pets: ok([pet]),
      today: TODAY,
    })
    expect(state.status).toBe('ready')
    expect(state.status === 'ready' && state.basis.date).toBe('2026-09-12')
  })

  it('일차가 기간 밖이면 none 이다', () => {
    expect(
      planBasisState({
        context: { ...context, day: 9 },
        plan: ok(planDetail),
        weatherBasisPetId: null,
        pets: ok([pet]),
        today: TODAY,
      }),
    ).toEqual({ status: 'none' })
  })
})

/*
  지난 여행(다녀온 일정)의 항목에서 들어오면 지난 날짜로 물었다 — dev 에서 산책은 `UNKNOWN`, 적합도는
  `INSUFFICIENT`, 근거는 "내일 일정으로 확인해 주세요" 가 왔다. 날짜만 오늘로 물러서고 반려견은 그
  일정의 아이 그대로다 (#1476 · D1-5-5).
*/
describe('지난 여행일 — 날짜는 오늘로 물러선다 (#1476)', () => {
  const resolve = (day: number, today: string) =>
    resolvePlanBasis({
      plan: twoPetPlan,
      day,
      basisPetId: secondPet.petId,
      pets: [pet, secondPet],
      today,
    })

  it('오늘보다 앞선 일차는 past 다', () => {
    expect(resolve(1, '2026-09-13')?.past).toBe(true)
    expect(resolve(3, '2026-10-13')?.past).toBe(true)
  })

  it('오늘과 앞날은 past 가 아니다 — 여행 중의 오늘 일차는 그날로 판정한다', () => {
    expect(resolve(2, '2026-09-13')?.past).toBe(false)
    expect(resolve(3, '2026-09-13')?.past).toBe(false)
    expect(resolve(1, '2026-09-01')?.past).toBe(false)
  })

  /** 테스트 입력이 기간 안이라 늘 고른다 — 못 고르면 테스트가 틀린 것이다 */
  const ready = (day: number, today: string): PlanBasisState => {
    const basis = resolve(day, today)
    if (basis === null) throw new Error('기준을 못 골랐다')
    return { status: 'ready', basis }
  }

  it('지난 여행일이면 판정 날짜가 없다(오늘 판정) — 반려견은 그 일정의 아이 그대로다', () => {
    const state = ready(1, '2026-10-13')

    expect(tripOfBasis(state)).toBeNull()
    expect(basisPetOf(state, pet)).toBe(secondPet)
  })

  it('오늘 · 앞날 일차는 그 여행일로 판정한다', () => {
    expect(tripOfBasis(ready(2, '2026-09-13'))?.date).toBe('2026-09-13')
  })

  it('기준이 없거나 정하는 중이면 여행 날짜가 없다', () => {
    expect(tripOfBasis({ status: 'none' })).toBeNull()
    expect(tripOfBasis({ status: 'pending' })).toBeNull()
  })

  it('planBasisState 가 오늘을 그대로 넘긴다', () => {
    const state = planBasisState({
      context: { planId: twoPetPlan.planId, day: 1 },
      plan: { data: twoPetPlan, pending: false, failed: false },
      weatherBasisPetId: null,
      pets: { data: [pet, secondPet], pending: false, failed: false },
      today: '2026-10-13',
    })

    expect(state.status).toBe('ready')
    expect(tripOfBasis(state)).toBeNull()
  })
})

describe('basisPetOf — 화면 전체가 쓰는 기준 반려견 (#1459)', () => {
  const basis = { pet: secondPet, date: '2026-09-12', tripDates: ['2026-09-12'], past: false }

  it('일정 기준이 정해졌으면 헤더에서 고른 아이가 아니라 그 아이다', () => {
    expect(basisPetOf({ status: 'ready', basis }, pet)).toBe(secondPet)
  })

  it('맥락이 없거나 물러서면(none) 헤더에서 고른 아이다', () => {
    expect(basisPetOf({ status: 'none' }, pet)).toBe(pet)
    expect(basisPetOf({ status: 'none' }, null)).toBeNull()
  })

  it('기준을 정하는 동안(pending)은 아무 아이도 아니다 — 헤더 아이를 먼저 그렸다가 바꾸지 않는다', () => {
    expect(basisPetOf({ status: 'pending' }, pet)).toBeNull()
  })
})

describe('weatherBasisPetIdOf — 일정 판정 조회를 기준견 입력으로 (#1492)', () => {
  const days = [
    { day: 1, basisPetId: '9007199254740993' },
    { day: 2, basisPetId: null },
  ]

  it('조회가 실패하면 null 이다 — 기준견 없이 대표 반려견으로 간다', () => {
    expect(weatherBasisPetIdOf({ isError: true, days: undefined }, 1)).toBeNull()
  })

  it('실패가 조회 중보다 먼저다 — 실패한 조회는 data 가 비어도 기다리지 않는다', () => {
    expect(weatherBasisPetIdOf({ isError: true, days: undefined }, 1)).not.toBeUndefined()
  })

  it('아직 못 받았으면 undefined 다 — 조회 중이라 기다린다', () => {
    expect(weatherBasisPetIdOf({ isError: false, days: undefined }, 1)).toBeUndefined()
  })

  it('그 일차 항목이 없으면 null 이다', () => {
    expect(weatherBasisPetIdOf({ isError: false, days }, 3)).toBeNull()
  })

  it('맥락의 일차가 없으면(미로그인 · 쿼리 없음) null 이다', () => {
    expect(weatherBasisPetIdOf({ isError: false, days }, undefined)).toBeNull()
  })

  it('항목의 basisPetId 가 null 이면 null 이다', () => {
    expect(weatherBasisPetIdOf({ isError: false, days }, 2)).toBeNull()
  })

  it('그 일차의 basisPetId 를 문자열 그대로 돌려준다', () => {
    expect(weatherBasisPetIdOf({ isError: false, days }, 1)).toBe('9007199254740993')
  })
})
