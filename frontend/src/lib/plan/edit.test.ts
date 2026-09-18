import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { planEditPetIds, toPlanUpdatePayload, validatePlanEdit } from '@/lib/plan/edit'
import type { Pet } from '@/types/pet'

/**
 * 이름 · 기간 · 예산 · **동행 반려견** 수정의 순수 로직 (#622 · 명세 D13-9).
 *
 * 여기서 잠그는 것은 **`petIds` 를 언제 보내는가** 하나다. 서버는 같은 키를 네 가지로
 * 읽는다 — 미전송/`null` = 유지, `[a,b]` = 전량 교체, `[]` = 400 `PLAN_010`
 * (명세 D13-1). 화면이 "바뀌지 않았는데도" 실어 보내면 완료 일정에서는 `PLAN_019` 로
 * 저장 자체가 죽고, 그 밖에서는 `plan_pet` 을 지웠다 다시 넣는 빈 쓰기가 된다.
 */

const BASE = {
  title: '제주 3박 4일',
  startDate: '2026-10-01',
  endDate: '2026-10-04',
  budget: '300000',
  petIds: ['1', '2'],
}

/** 동행견을 고칠 수 있는 일정 (초안 · 확정, 옵션이 하나 이상) */
const EDITABLE = { petsEditable: true, initialPetIds: ['1', '2'] }

describe('toPlanUpdatePayload — 동행견이 바뀌었을 때만 petIds 를 싣는다', () => {
  it('동행견이 그대로면 payload 에 petIds 키가 없다', () => {
    const payload = toPlanUpdatePayload(BASE, EDITABLE)

    // `undefined` 로라도 있으면 JSON 직렬화에서는 사라지지만, 키의 유무가 곧 계약이다
    expect('petIds' in payload).toBe(false)
  })

  it('한 마리를 더하면 petIds 가 배열로 실린다', () => {
    const payload = toPlanUpdatePayload({ ...BASE, petIds: ['1', '2', '3'] }, EDITABLE)

    expect(payload.petIds).toEqual(['1', '2', '3'])
  })

  it('한 마리여도 배열이고 문자열 그대로다 — Number() 를 거치지 않는다', () => {
    /*
      Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다 (`lib/ai-plan/submit.ts` 와 같은
      규칙). 요청 스키마가 `int64` 여도 FE 는 응답이 준 문자열을 그대로 싣는다.
    */
    const petId = '1234567890123456789'
    const payload = toPlanUpdatePayload({ ...BASE, petIds: [petId] }, EDITABLE)

    expect(payload.petIds).toEqual([petId])
    expect(payload.petIds?.[0]).toBe(petId)
  })

  it('순서만 바뀌어도 실린다 — 첫 번째가 대표다', () => {
    const payload = toPlanUpdatePayload({ ...BASE, petIds: ['2', '1'] }, EDITABLE)

    expect(payload.petIds).toEqual(['2', '1'])
  })

  it('petsEditable 이 false 면 폼 값이 남아 있어도 키가 새지 않는다', () => {
    /*
      완료 일정에서 키가 새면 **제목만 고치려던 저장이 `PLAN_019` 로 죽는다.**
      화면이 컨트롤을 숨기는 것과 별개로 변환에서 한 번 더 잠근다 (명세 D13-4).
    */
    const payload = toPlanUpdatePayload(
      { ...BASE, petIds: ['3'] },
      { petsEditable: false, initialPetIds: ['1', '2'] },
    )

    expect('petIds' in payload).toBe(false)
  })

  it('빈 선택은 []로 나가지 않는다 — 서버가 400 PLAN_010 으로 거절한다', () => {
    /*
      검증(`validatePlanEdit`)이 먼저 막지만 변환도 만들지 않는다. 생성과 달리 수정에는
      대표견 폴백이 **없어서**, 실어 보내면 저장이 통째로 실패한다 (명세 D13-1).
    */
    const payload = toPlanUpdatePayload({ ...BASE, petIds: [] }, EDITABLE)

    expect('petIds' in payload).toBe(false)
  })

  it('회귀: status 키는 여전히 없다 / 예산을 비우면 0 / 두 날짜를 함께 보낸다', () => {
    const payload = toPlanUpdatePayload({ ...BASE, budget: '' }, EDITABLE)

    expect('status' in payload).toBe(false)
    expect(payload.budget).toBe(0)
    expect(payload.startDate).toBe('2026-10-01')
    expect(payload.endDate).toBe('2026-10-04')
  })
})

describe('validatePlanEdit — 0마리는 화면이 먼저 막는다', () => {
  it('0마리면 petIds 오류가 errorPetRequired 로 잡힌다', () => {
    const errors = validatePlanEdit({ ...BASE, petIds: [] }, EDITABLE)

    expect(errors.petIds).toBe(messages.plan.errorPetRequired)
  })

  it('petsEditable 이 false 면 0마리여도 오류가 없다 — 완료 일정엔 그 필드가 없다', () => {
    const errors = validatePlanEdit({ ...BASE, petIds: [] }, { petsEditable: false })

    expect(errors.petIds).toBeUndefined()
    expect(Object.keys(errors)).toEqual([])
  })
})

function pet(petId: string, name: string): Pet {
  return {
    petId,
    name,
    breed: '말티즈',
    birthYm: '2017-05',
    age: 9,
    sizeType: { code: 'SMALL', name: '소형견', description: null },
    weightKg: 3.5,
    heatSensitive: false,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: { code: 'MEDIUM', name: '활동량 보통', description: null },
    walkPreferred: true,
    sociality: { code: 'HIGH', name: '사회성 높음', description: null },
    profileImageUrl: null,
    representative: false,
  }
}

describe('planEditPetIds — 초기 선택', () => {
  it('옵션에 없는(삭제된) id 는 빠지고 나머지는 plan.petIds 순서를 지킨다', () => {
    /*
      삭제된 아이가 `plan.petIds` 에 남아 있어도 화면은 그 id 를 보여 주지 않는다
      (`companionPetsOf` 와 같은 규칙). 그래서 "변경 없음" 이면 키가 실리지 않고,
      요청하지 않은 정리가 저장에 섞이지 않는다 (명세 D13-4 · 미결 2).
    */
    expect(planEditPetIds(['2', '9', '1'], [pet('1', '몽실이'), pet('2', '초코')])).toEqual([
      '2',
      '1',
    ])
  })
})
