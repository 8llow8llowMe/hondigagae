import { describe, expect, it } from 'vitest'

import { companionLabel, companionNamesOf, companionPetsOf } from '@/lib/plan/companion-pets'
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

describe('companionNamesOf', () => {
  const NAMES = new Map([
    ['1', '몽실이'],
    ['2', '초코'],
  ])

  it('petIds 순서로 이름을 준다', () => {
    expect(companionNamesOf(['2', '1'], NAMES)).toEqual(['초코', '몽실이'])
  })

  it('맵에 없는 id 는 조용히 뺀다', () => {
    expect(companionNamesOf(['1', '9'], NAMES)).toEqual(['몽실이'])
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
