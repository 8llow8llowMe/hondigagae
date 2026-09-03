import { describe, expect, it } from 'vitest'

import { basisPetNameOf } from '@/lib/plan/basis-pet'

const NAMES = new Map([
  ['1', '몽실이'],
  ['2', '초코'],
])

describe('basisPetNameOf', () => {
  /*
    한 마리 일정에는 기준이 그 아이뿐이라 이름이 정보를 더하지 않는다. 대다수 일정에
    줄이 하나 늘어나는 것을 막는다 — #176 이 고른 범위(기준 아이 이름 한 줄)의 전제다.
  */
  it('한 마리 일정에는 붙이지 않는다', () => {
    expect(basisPetNameOf('1', ['1'], NAMES)).toBeNull()
  })

  it('두 마리 이상이면 기준 아이 이름을 준다', () => {
    expect(basisPetNameOf('2', ['1', '2'], NAMES)).toBe('초코')
  })

  /*
    기준은 그날 점수가 가장 낮은 아이라 대표(petIds[0])와 다를 수 있다
    (`PlanWeatherProcessor.pickBasisPet`). 대표 이름을 붙이면 거짓이 된다.
  */
  it('대표가 아니어도 그대로 준다', () => {
    expect(basisPetNameOf('2', ['1', '2'], NAMES)).not.toBe('몽실이')
  })

  it('판정을 못 낸 날(basisPetId 가 null)은 붙이지 않는다', () => {
    expect(basisPetNameOf(null, ['1', '2'], NAMES)).toBeNull()
  })

  /*
    삭제된 반려견이거나 목록 조회가 실패한 경우다. id 를 그대로 노출하거나 "알 수 없음" 을
    붙이면 화면이 더 나빠진다.
  */
  it('이름을 못 찾으면 생략한다 — id 를 노출하지 않는다', () => {
    expect(basisPetNameOf('999', ['1', '999'], NAMES)).toBeNull()
  })
})
