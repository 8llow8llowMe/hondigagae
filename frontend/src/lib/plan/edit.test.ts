import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import {
  planEditPetIds,
  planEditPetsHint,
  toPlanUpdatePayload,
  validatePlanEdit,
} from '@/lib/plan/edit'
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

/**
 * **동행견이 전부 삭제된 일정** (#752). 그 회원에게 다른 반려견이 남아 있어 그룹은 서지만
 * (`petsEditable: true`) 초기 선택은 비어 있다 — `planEditPetIds` 가 옵션에 없는 잔여 id 를
 * 빼기 때문이다 (D13-4).
 */
const CLEARED = { petsEditable: true, initialPetIds: [] }

/** 완료 일정이거나 고를 반려견이 없어 그룹 자체가 없는 폼 (D13-2 · D13-3) */
const NO_GROUP = { petsEditable: false, initialPetIds: ['1', '2'] }

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
  it('있던 동행견을 전부 해제하면 errorPetRequired 로 막는다', () => {
    /*
      **회귀 방지다** (#752). 의도적인 전체 해제까지 통과시키면 서버가 빈 배열을
      `PLAN_010` 으로 거절해 왕복 한 번을 배너로 듣는다.
    */
    const errors = validatePlanEdit({ ...BASE, petIds: [] }, EDITABLE)

    expect(errors.petIds).toBe(messages.plan.errorPetRequired)
  })

  it('petsEditable 이 false 면 0마리여도 오류가 없다 — 완료 일정엔 그 필드가 없다', () => {
    const errors = validatePlanEdit({ ...BASE, petIds: [] }, NO_GROUP)

    expect(errors.petIds).toBeUndefined()
    expect(Object.keys(errors)).toEqual([])
  })
})

/**
 * **동행견이 전부 삭제된 일정도 이름 · 기간 · 예산을 저장할 수 있다** (#752 · 명세 D13-5).
 *
 * 0마리가 두 가지 사실을 가리킨다 — *사용자가 방금 전부 해제했다* 와 *처음부터 그렇게
 * 열렸다*. 앞은 조작이라 막고, 뒤는 **시작 상태**라 막지 않는다. 구분하지 않으면 그 일정은
 * 제목 하나 고칠 수 없는 채로 남는다.
 */
describe('validatePlanEdit — 처음부터 0마리였으면 막지 않는다 (#752)', () => {
  it('초기 선택이 비어 있고 아무것도 고르지 않으면 오류가 없다', () => {
    const errors = validatePlanEdit({ ...BASE, petIds: [] }, CLEARED)

    expect(errors.petIds).toBeUndefined()
    expect(Object.keys(errors)).toEqual([])
  })

  it('그 저장의 payload 에는 petIds 키가 없다 — 서버가 "유지" 로 읽는다', () => {
    /*
      키가 없으면 서버는 소유 검증조차 부르지 않는다 (`PlanWebFacade.java:111-112`).
      검증이 열린 것과 변환이 키를 만들지 않는 것이 **함께** 있어야 저장이 통과한다.
    */
    const payload = toPlanUpdatePayload({ ...BASE, petIds: [] }, CLEARED)

    expect('petIds' in payload).toBe(false)
    expect(payload.title).toBe('제주 3박 4일')
  })

  it('거기서 한 마리를 고르면 오류 없이 petIds 가 실린다 — 사용자가 스스로 고치는 경로다', () => {
    const values = { ...BASE, petIds: ['3'] }

    expect(Object.keys(validatePlanEdit(values, CLEARED))).toEqual([])
    expect(toPlanUpdatePayload(values, CLEARED).petIds).toEqual(['3'])
  })
})

/**
 * 그룹 아래 한 줄 — `PlanEditModal` 이 `useQueryClient` 를 쓰므로 node 환경에서 렌더되지
 * 않는다 (`testing-guide.md` §1 한계). 분기를 순수 함수로 내려 여기서 잠근다.
 */
describe('planEditPetsHint — 0마리로 열린 폼만 다른 말을 한다 (#752)', () => {
  it('초기 0마리 + 지금도 0마리면 "모두 지워졌다" 를 말한다', () => {
    expect(planEditPetsHint({ petIds: [] }, { initialPetIds: [] })).toBe(
      messages.plan.editPetsClearedHint,
    )
  })

  it('거기서 하나라도 고르면 곧바로 기존 대표 힌트로 돌아온다', () => {
    expect(planEditPetsHint({ petIds: ['3'] }, { initialPetIds: [] })).toBe(
      messages.plan.editPetsHint,
    )
  })

  it('초기 선택이 있었으면 전부 해제해도 대표 힌트다 — 그 0마리는 오류가 말한다', () => {
    expect(planEditPetsHint({ petIds: [] }, { initialPetIds: ['1', '2'] })).toBe(
      messages.plan.editPetsHint,
    )
  })

  it('평소에는 대표 힌트다', () => {
    expect(planEditPetsHint({ petIds: ['1', '2'] }, { initialPetIds: ['1', '2'] })).toBe(
      messages.plan.editPetsHint,
    )
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

  /**
   * 삭제 정도별로 **저장이 되는가**를 한 자리에서 잠근다 (#752). 셋이 같은 경로를 타는
   * 것처럼 보이지만 판정이 갈리는 지점이 다르다 — 앞 둘은 초기 선택과 같아서/그룹이 없어서
   * 통과하고, 마지막 하나가 이번에 연 갈래다.
   */
  it('동행견이 일부만 삭제돼도 이름·기간·예산이 저장된다 — 초기 선택과 같아 키가 안 실린다', () => {
    const pets = [pet('1', '몽실이')]
    const initialPetIds = planEditPetIds(['1', '9'], pets)
    const context = { petsEditable: true, initialPetIds }

    expect(initialPetIds).toEqual(['1'])
    expect(Object.keys(validatePlanEdit({ ...BASE, petIds: initialPetIds }, context))).toEqual([])
    expect('petIds' in toPlanUpdatePayload({ ...BASE, petIds: initialPetIds }, context)).toBe(false)
  })

  it('전부 삭제 + 고를 반려견도 없으면 그룹이 없어 저장된다', () => {
    const initialPetIds = planEditPetIds(['9'], [])
    const context = { petsEditable: false, initialPetIds }

    expect(initialPetIds).toEqual([])
    expect(Object.keys(validatePlanEdit({ ...BASE, petIds: [] }, context))).toEqual([])
    expect('petIds' in toPlanUpdatePayload({ ...BASE, petIds: [] }, context)).toBe(false)
  })

  it('전부 삭제 + 다른 반려견 보유여도 저장된다 — #752 가 막혀 있던 자리다', () => {
    const pets = [pet('7', '보리')]
    const initialPetIds = planEditPetIds(['9'], pets)
    const context = { petsEditable: true, initialPetIds }

    expect(initialPetIds).toEqual([])
    expect(Object.keys(validatePlanEdit({ ...BASE, petIds: [] }, context))).toEqual([])
    expect('petIds' in toPlanUpdatePayload({ ...BASE, petIds: [] }, context)).toBe(false)
  })
})
