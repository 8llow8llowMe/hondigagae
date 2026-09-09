import { describe, expect, it } from 'vitest'

import {
  sizeChangeForWeight,
  sizeFromWeight,
  sizeFromWeightInput,
  sizeMatchesWeightInput,
} from '@/lib/pet/size'

/*
  **경계는 백엔드 `PetSizeType.fromWeight` 와 같아야 한다** (#369 · BE #364).
  갈리면 FE 가 맞춰 준 크기를 백엔드가 `PET_004` 로 거부한다 — 사용자는 자기가 고르지도
  않은 값 때문에 400 을 받는다.

  경계값은 백엔드 `PetSizeTypeTest` 가 고정한 것과 같은 여섯 개다.
*/
describe('sizeFromWeight — 경계 (#369)', () => {
  it.each([
    [0.1, 'SMALL'],
    [9.9, 'SMALL'],
    [10.0, 'MEDIUM'],
    [24.9, 'MEDIUM'],
    [25.0, 'LARGE'],
    [99.9, 'LARGE'],
  ])('%s kg → %s', (weight, expected) => {
    expect(sizeFromWeight(weight)).toBe(expected)
  })

  /* 위쪽이 열린 경계다 — `10.0` 은 소형이 아니고 `25.0` 은 중형이 아니다 */
  it('경계값은 위 구간에 속한다 — 10.0 은 중형, 25.0 은 대형', () => {
    expect(sizeFromWeight(10)).not.toBe('SMALL')
    expect(sizeFromWeight(25)).not.toBe('MEDIUM')
  })

  /* 체중은 선택 입력이다. 없는 값으로 크기를 지어내지 않는다 */
  it('체중을 모르면 크기를 지어내지 않는다', () => {
    expect(sizeFromWeight(null)).toBeNull()
    expect(sizeFromWeight(Number.NaN)).toBeNull()
  })
})

describe('sizeFromWeightInput — 폼 문자열', () => {
  it('단위를 적어도 읽는다 — 입력란이 kg 를 보여준다', () => {
    expect(sizeFromWeightInput('3.5')).toBe('SMALL')
    expect(sizeFromWeightInput('3.5kg')).toBe('SMALL')
    expect(sizeFromWeightInput(' 30 kg ')).toBe('LARGE')
  })

  /*
    **타이핑 도중에 라디오가 튀지 않게 하는 것이 이 갈래의 값어치다.** `1` 을 치고
    `1.` 까지 갔다가 `12` 로 끝나는 흐름에서, 읽을 수 없는 중간 값에 반응하면
    소형 → (그대로) → 중형으로 두 번 움직인다.
  */
  it('읽을 수 없는 값은 null 이다 — 라디오가 타이핑 중에 튀지 않는다', () => {
    expect(sizeFromWeightInput('')).toBeNull()
    expect(sizeFromWeightInput('1.')).toBeNull()
    expect(sizeFromWeightInput('abc')).toBeNull()
  })
})

describe('sizeMatchesWeightInput — 모순 판정', () => {
  it('경계마다 맞는 크기 하나만 통과한다', () => {
    expect(sizeMatchesWeightInput('SMALL', '9.9')).toBe(true)
    expect(sizeMatchesWeightInput('MEDIUM', '9.9')).toBe(false)

    expect(sizeMatchesWeightInput('MEDIUM', '10.0')).toBe(true)
    expect(sizeMatchesWeightInput('SMALL', '10.0')).toBe(false)

    expect(sizeMatchesWeightInput('MEDIUM', '24.9')).toBe(true)
    expect(sizeMatchesWeightInput('LARGE', '24.9')).toBe(false)

    expect(sizeMatchesWeightInput('LARGE', '25.0')).toBe(true)
    expect(sizeMatchesWeightInput('MEDIUM', '25.0')).toBe(false)
  })

  /* 이슈가 든 예 — 30kg 소형견이 저장되면 "소형견만 가능" 장소를 동반 가능으로 읽는다 */
  it('30kg 소형견을 막는다', () => {
    expect(sizeMatchesWeightInput('SMALL', '30')).toBe(false)
  })

  /* 체중이 없으면 어긋남을 판정할 수 없다 — 백엔드 `matchesWeight` 와 같다 */
  it('체중이 비었으면 어느 크기든 통과한다', () => {
    for (const size of ['SMALL', 'MEDIUM', 'LARGE'] as const) {
      expect(sizeMatchesWeightInput(size, '')).toBe(true)
    }
  })
})

/*
  폼이 실제로 쓰는 갈래 — 체중을 적었을 때 크기 라디오를 옮길지 말지.
  `PetForm` 은 상태를 갖는 client 컴포넌트라 node 환경에서 상호작용을 돌릴 수 없다.
  **판단을 순수 함수로 내려 두고 그것을 검사한다** (`form-guide.md` §2).
*/
describe('sizeChangeForWeight — 자동 선택 (#369)', () => {
  it('어긋난 크기를 체중에 맞게 옮긴다', () => {
    expect(sizeChangeForWeight('30', 'SMALL')).toBe('LARGE')
    expect(sizeChangeForWeight('3.5', 'LARGE')).toBe('SMALL')
    expect(sizeChangeForWeight('12', 'SMALL')).toBe('MEDIUM')
  })

  /*
    **이미 맞으면 아무것도 하지 않는다.** 같은 값을 다시 쓰면 `isDirty` 가 켜져,
    아무것도 고치지 않고 나가는 사용자에게 이탈 경고가 뜬다.
  */
  it('이미 맞는 크기면 옮기지 않는다', () => {
    expect(sizeChangeForWeight('3.5', 'SMALL')).toBeNull()
    expect(sizeChangeForWeight('12', 'MEDIUM')).toBeNull()
    expect(sizeChangeForWeight('30', 'LARGE')).toBeNull()
  })

  it('읽을 수 없는 값에는 반응하지 않는다 — 타이핑 중 라디오가 튀지 않는다', () => {
    expect(sizeChangeForWeight('', 'SMALL')).toBeNull()
    expect(sizeChangeForWeight('1.', 'LARGE')).toBeNull()
  })

  /* 체중을 지우면 마지막에 맞춰 둔 크기가 그대로 남는다 — 크기는 필수라 비울 수 없다 */
  it('체중을 지워도 크기를 되돌리지 않는다', () => {
    expect(sizeChangeForWeight('', 'LARGE')).toBeNull()
  })

  it.each([
    ['9.9', 'SMALL'],
    ['10.0', 'MEDIUM'],
    ['24.9', 'MEDIUM'],
    ['25.0', 'LARGE'],
  ])('경계 %s kg 은 %s 로 맞춘다', (weight, expected) => {
    // 어느 크기에서 출발하든 같은 곳에 닿는다
    const from = expected === 'SMALL' ? 'LARGE' : 'SMALL'

    expect(sizeChangeForWeight(weight, from)).toBe(expected)
  })
})
