import { describe, expect, it } from 'vitest'

import {
  companionLabel,
  companionPetsOf,
  planCompanionLabel,
  planCompanionsOf,
} from '@/lib/plan/companion-pets'
import { planEditPetIds } from '@/lib/plan/edit'
import type { Pet } from '@/types/pet'

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

const MONGSIL = pet('1', '몽실이')
const CHOCO = pet('2', '초코')

describe('companionPetsOf', () => {
  it('petIds 순서로 돌려준다 — 대표가 앞이다', () => {
    expect(companionPetsOf(['2', '1'], [MONGSIL, CHOCO]).map((entry) => entry.name)).toEqual([
      '초코',
      '몽실이',
    ])
  })

  /*
    조회에 실패했거나 삭제된 반려견은 `pets` 에 없다 (`types/plan.ts:122`). id 를 노출하거나
    "알 수 없음" 을 세우면 화면이 더 나빠진다 — `basisPetNameOf` 와 같은 판단이다.
  */
  it('찾지 못한 반려견은 조용히 뺀다', () => {
    expect(companionPetsOf(['1', '9'], [MONGSIL, CHOCO]).map((entry) => entry.name)).toEqual([
      '몽실이',
    ])
  })

  it('하나도 못 찾으면 빈 배열이다', () => {
    expect(companionPetsOf(['8', '9'], [MONGSIL])).toEqual([])
  })
})

describe('companionLabel', () => {
  it('한 마리면 이름만 말한다', () => {
    expect(companionLabel(['몽실이'])).toBe('몽실이')
  })

  /*
    **두 마리부터는 수를 말한다.** 이름을 나열하면 5마리까지 늘어나 목록 행의 폭이 터진다
    (`pet.ts` limitReached: 최대 5마리). 목록은 신원 요약이고 전체 명단은 상세가 세운다.
  */
  it('두 마리면 대표 이름과 나머지 수를 말한다', () => {
    expect(companionLabel(['몽실이', '초코'])).toBe('몽실이 외 1마리')
  })

  it('세 마리도 같은 형식이다', () => {
    expect(companionLabel(['몽실이', '초코', '콩이'])).toBe('몽실이 외 2마리')
  })

  /*
    반려견 조회가 통째로 실패하면 행에서 이 자리만 빠진다 — 행을 숨기지 않는다
    (공통명세 S8, `plan-row.tsx` 주석).
  */
  it('빈 목록이면 null 이다', () => {
    expect(companionLabel([])).toBeNull()
  })
})

/*
  #1042. 반려견을 지우면 plan-service 가 다견 미완료 일정의 `petIds` 에서 그 아이를 뗀다.
  그런데 **그 아이만 동행하던 미완료 일정**은 "일정에 최소 한 마리"(`PLAN_010`) 때문에 지운
  petId 가 자리 표시자로 남고, **완료 일정**은 기록이라 손대지 않는다 (plan-service.md
  "반려견이 삭제되면" R1·R3). 화면은 `petIds ∩ 내 반려견 목록` 으로 읽는다.
*/
describe('planCompanionsOf', () => {
  it('반려견 목록을 모르면(조회 중·실패) 아무것도 단정하지 않는다', () => {
    expect(planCompanionsOf(['1'], null, 'DRAFT')).toEqual({ kind: 'unknown' })
    expect(planCompanionsOf(['1'], null, 'COMPLETED')).toEqual({ kind: 'unknown' })
  })

  it('찾은 아이를 petIds 순서로 세운다', () => {
    expect(planCompanionsOf(['2', '1'], [MONGSIL, CHOCO], 'CONFIRMED')).toEqual({
      kind: 'listed',
      pets: [CHOCO, MONGSIL],
      deletedCount: 0,
    })
  })

  it('미완료 일정에서 교집합이 비면 "동행 반려견 없음" 이다 — 자리 표시자만 남은 일정', () => {
    expect(planCompanionsOf(['9'], [MONGSIL], 'DRAFT')).toEqual({ kind: 'none' })
    expect(planCompanionsOf(['9'], [MONGSIL], 'CONFIRMED')).toEqual({ kind: 'none' })
  })

  it('반려견이 하나도 남지 않은 회원의 미완료 일정도 "동행 반려견 없음" 이다', () => {
    expect(planCompanionsOf(['9'], [], 'DRAFT')).toEqual({ kind: 'none' })
  })

  /*
    미완료 다견 일정의 죽은 id 는 삭제 트리거가 이미 뗐다. 남아 있다면 트리거가 실패해 새벽
    배치를 기다리는 중이고, 배치가 곧 떼어 갈 값이다 — 이름을 세우지 않는다.
  */
  it('미완료 일정에서 못 찾은 아이는 조용히 뺀다 — 남은 아이가 있으면', () => {
    expect(planCompanionsOf(['1', '9'], [MONGSIL], 'DRAFT')).toEqual({
      kind: 'listed',
      pets: [MONGSIL],
      deletedCount: 0,
    })
  })

  it('완료 일정에서 못 찾은 아이는 "삭제된 반려견" 으로 센다 — 다녀온 기록이다', () => {
    expect(planCompanionsOf(['1', '9'], [MONGSIL], 'COMPLETED')).toEqual({
      kind: 'listed',
      pets: [MONGSIL],
      deletedCount: 1,
    })
  })

  it('완료 일정의 동행이 전부 지워졌어도 "동행 반려견 없음" 이 아니다', () => {
    expect(planCompanionsOf(['8', '9'], [MONGSIL], 'COMPLETED')).toEqual({
      kind: 'listed',
      pets: [],
      deletedCount: 2,
    })
  })
})

describe('planCompanionLabel', () => {
  it('모르면 null 이다 — 행에서 이 자리만 빠진다', () => {
    expect(planCompanionLabel({ kind: 'unknown' })).toBeNull()
  })

  it('동행 반려견 없음', () => {
    expect(planCompanionLabel({ kind: 'none' })).toBe('동행 반려견 없음')
  })

  it('지운 아이가 없으면 지금까지와 같다', () => {
    expect(planCompanionLabel({ kind: 'listed', pets: [MONGSIL, CHOCO], deletedCount: 0 })).toBe(
      '몽실이 외 1마리',
    )
  })

  it('남은 아이가 있으면 지운 아이까지 수로 센다 — 함께 다녀온 수가 줄지 않는다', () => {
    expect(planCompanionLabel({ kind: 'listed', pets: [MONGSIL], deletedCount: 1 })).toBe(
      '몽실이 외 1마리',
    )
  })

  it('지운 아이만 남았으면 "삭제된 반려견" 이다', () => {
    expect(planCompanionLabel({ kind: 'listed', pets: [], deletedCount: 1 })).toBe('삭제된 반려견')
    expect(planCompanionLabel({ kind: 'listed', pets: [], deletedCount: 2 })).toBe(
      '삭제된 반려견 2마리',
    )
  })
})

/*
  **편집 폼은 표시 규칙을 따라가지 않는다** (#1042). 폼의 초기 체크는 여전히 "옵션에 있는
  아이만" 이다 — 자리 표시자 id 를 체크된 채로 열면 저장에 지운 아이가 실려 `PLAN_011`(본인 소유가
  아닌 반려견) 400 으로 저장 전체가 죽는다. 0마리로 열린 폼의 저장은 #752 가 이미 열어 두었다.
*/
describe('planEditPetIds — 자리 표시자가 남은 일정', () => {
  it('지운 아이의 id 는 초기 체크에 들어가지 않는다', () => {
    expect(planEditPetIds(['9'], [MONGSIL])).toEqual([])
    expect(planEditPetIds(['1', '9'], [MONGSIL])).toEqual(['1'])
  })
})
