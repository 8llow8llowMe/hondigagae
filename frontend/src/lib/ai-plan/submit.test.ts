import { describe, expect, it } from 'vitest'

import { MANWON, toAiPlanSubmitPayload } from '@/lib/ai-plan/submit'
import type { AiPlanFormValues, AiPlanSubmitPayload } from '@/types/ai-plan'

function values(overrides: Partial<AiPlanFormValues> = {}): AiPlanFormValues {
  return {
    requestNote: '',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    petIds: ['123456789012000001'],
    budgetManwon: '',
    preferFavorites: false,
    pinnedPlaces: [],
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

  it('petIds 를 배열로 보낸다', () => {
    const payload = toAiPlanSubmitPayload(
      values({ petIds: ['1234567890123456789', '9876543210987654321'] }),
    )

    expect(payload.petIds).toEqual(['1234567890123456789', '9876543210987654321'])
  })

  it('한 마리여도 배열이다 — 분기를 만들지 않는다 (명세 D2-2)', () => {
    const payload = toAiPlanSubmitPayload(values({ petIds: ['1234567890123456789'] }))

    expect(payload.petIds).toEqual(['1234567890123456789'])
    expect('petId' in payload).toBe(false)
  })

  it('Snowflake 를 숫자로 바꾸지 않는다', () => {
    const petId = '212481712381923328'
    const payload = toAiPlanSubmitPayload(values({ petIds: [petId] }))

    expect(payload.petIds[0]).toBe(petId)
    expect(typeof payload.petIds[0]).toBe('string')
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

describe('toAiPlanSubmitPayload — 생성 옵션 확장 (#128, 아트보드 05)', () => {
  it('preferFavorites 를 끄면 키를 보내지 않는다 — 서버 기본이 false 다', () => {
    const payload = toAiPlanSubmitPayload(values({ preferFavorites: false }))

    expect('preferFavorites' in payload).toBe(false)
  })

  it('preferFavorites 를 켜면 true 로 보낸다', () => {
    expect(toAiPlanSubmitPayload(values({ preferFavorites: true })).preferFavorites).toBe(true)
  })

  it('고른 곳이 없으면 pinnedPlaceIds 키를 보내지 않는다 — 생략이 "고르지 않았다" 다', () => {
    const payload = toAiPlanSubmitPayload(values({ pinnedPlaces: [] }))

    expect('pinnedPlaceIds' in payload).toBe(false)
  })

  it('이름을 떼고 placeId 만 보낸다', () => {
    const payload = toAiPlanSubmitPayload(
      values({
        pinnedPlaces: [
          { placeId: '212481712381923328', title: '협재해수욕장' },
          { placeId: '212481712381923329', title: '쇠소깍' },
        ],
      }),
    )

    expect(payload.pinnedPlaceIds).toEqual(['212481712381923328', '212481712381923329'])
  })

  it('**placeId 를 숫자로 바꾸지 않는다** — Snowflake 라 정밀도를 잃는다', () => {
    const payload = toAiPlanSubmitPayload(
      values({ pinnedPlaces: [{ placeId: '212481712381923328', title: '협재해수욕장' }] }),
    )

    expect(payload.pinnedPlaceIds?.[0]).toBe('212481712381923328')
    expect(typeof payload.pinnedPlaceIds?.[0]).toBe('string')
  })

  /*
    #128 로 두 필드가 타입에 열렸다. **생성 경로에서는 여전히 안 실린다** — 이 함수는
    새 일정을 만드는 폼의 것이고, 하루 재생성은 `lib/ai-plan/regenerate.ts` 가 따로
    만든다 (하루재생성-세부명세 R3). 이 잠금을 없애면 생성 요청에 두 필드가 새어 드는
    회귀를 아무도 막지 않게 된다.
  */
  it('생성 경로에는 planId·regenerateDay 가 실리지 않는다 (#128)', () => {
    const payload = toAiPlanSubmitPayload(
      values({ preferFavorites: true, pinnedPlaces: [{ placeId: '1', title: '가' }] }),
    )

    expect('planId' in payload).toBe(false)
    expect('regenerateDay' in payload).toBe(false)

    // 타입에는 열려 있다 — 재생성 경로가 쓴다
    const withRegenerate: AiPlanSubmitPayload = { ...payload, planId: '1', regenerateDay: 2 }
    expect(withRegenerate.regenerateDay).toBe(2)
  })
})
