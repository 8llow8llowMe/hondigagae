import { describe, expect, it } from 'vitest'

import { MANWON, toAiPlanSubmitPayload } from '@/lib/ai-plan/submit'
import type { AiPlanFormValues } from '@/types/ai-plan'

function values(overrides: Partial<AiPlanFormValues> = {}): AiPlanFormValues {
  return {
    requestNote: '',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    petId: '123456789012000001',
    budgetManwon: '',
    ...overrides,
  }
}

describe('toAiPlanSubmitPayload — 필수 필드', () => {
  it('areaCode 를 제주(39)로 고정한다 — 계약에 sigunguCode 가 없어 폼에 지역이 없다', () => {
    expect(toAiPlanSubmitPayload(values()).areaCode).toBe('39')
  })

  it('기간을 그대로 실어 보낸다', () => {
    const payload = toAiPlanSubmitPayload(values())
    expect(payload.startDate).toBe('2026-09-12')
    expect(payload.endDate).toBe('2026-09-14')
  })

  it('petId 를 문자열로 유지한다 — Snowflake 라 Number() 를 거치면 정밀도를 잃는다', () => {
    const petId = '212481712381923328'
    const payload = toAiPlanSubmitPayload(values({ petId }))

    expect(payload.petId).toBe(petId)
    expect(typeof payload.petId).toBe('string')
    // Number 로 바꾸면 값이 달라진다는 것을 이 테스트가 증명한다
    expect(String(Number(petId))).not.toBe(petId)
  })
})

describe('toAiPlanSubmitPayload — budget 은 @Positive 다', () => {
  it('만원 단위 입력을 원 단위로 바꿔 보낸다', () => {
    expect(toAiPlanSubmitPayload(values({ budgetManwon: '30' })).budget).toBe(30 * MANWON)
  })

  it('빈 값("상관없음")이면 키 자체를 뺀다 — 0 을 보내면 AIPLAN_106 400 이다', () => {
    expect('budget' in toAiPlanSubmitPayload(values({ budgetManwon: '' }))).toBe(false)
  })

  it('공백만 있어도 키를 뺀다', () => {
    expect('budget' in toAiPlanSubmitPayload(values({ budgetManwon: '  ' }))).toBe(false)
  })

  it('0 이면 키를 뺀다 — @Positive 는 0 을 거부한다 (일정 생성의 @PositiveOrZero 와 다르다)', () => {
    expect('budget' in toAiPlanSubmitPayload(values({ budgetManwon: '0' }))).toBe(false)
  })

  it('숫자가 아니면 키를 뺀다 — 스키마가 먼저 막지만 전송 계층에서도 방어한다', () => {
    expect('budget' in toAiPlanSubmitPayload(values({ budgetManwon: '삼십' }))).toBe(false)
  })
})

describe('toAiPlanSubmitPayload — requestNote 는 선택이다', () => {
  it('빈 값이면 키를 뺀다', () => {
    expect('requestNote' in toAiPlanSubmitPayload(values({ requestNote: '' }))).toBe(false)
  })

  it('공백만 있으면 키를 뺀다 — 서버에 의미 없는 문자열을 보내지 않는다', () => {
    expect('requestNote' in toAiPlanSubmitPayload(values({ requestNote: '  \n ' }))).toBe(false)
  })

  it('값이 있으면 trim 해서 보낸다', () => {
    const payload = toAiPlanSubmitPayload(values({ requestNote: '  실내 위주로  ' }))
    expect(payload.requestNote).toBe('실내 위주로')
  })
})
