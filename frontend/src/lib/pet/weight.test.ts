import { describe, expect, it } from 'vitest'

import {
  isValidWeightInput,
  toPlaceFilterWeight,
  toWeightInput,
  toWeightPayload,
} from '@/lib/pet/weight'

describe('isValidWeightInput', () => {
  it('빈 값은 유효하다 — "모름" 이 정당한 답이다', () => {
    expect(isValidWeightInput('')).toBe(true)
    expect(isValidWeightInput('   ')).toBe(true)
  })

  it('범위 안의 값을 받는다', () => {
    expect(isValidWeightInput('0.1')).toBe(true)
    expect(isValidWeightInput('3.5')).toBe(true)
    expect(isValidWeightInput('99.9')).toBe(true)
    expect(isValidWeightInput('12')).toBe(true)
  })

  it('범위를 벗어나면 거부한다 (PET_108)', () => {
    expect(isValidWeightInput('0')).toBe(false)
    expect(isValidWeightInput('0.05')).toBe(false)
    expect(isValidWeightInput('100')).toBe(false)
  })

  it('소수점 두 자리는 거부한다 (PET_109)', () => {
    expect(isValidWeightInput('3.55')).toBe(false)
  })

  it('플레이스홀더를 따라 친 단위를 걷어낸다 — 우리가 보여준 예시가 함정이 되면 안 된다', () => {
    expect(isValidWeightInput('3.5kg')).toBe(true)
    expect(isValidWeightInput('3.5 kg')).toBe(true)
    expect(isValidWeightInput('12KG')).toBe(true)
    expect(toWeightPayload('3.5kg')).toBe(3.5)
    // 단위를 걷어도 값의 성질은 그대로 본다
    expect(isValidWeightInput('100kg')).toBe(false)
    expect(isValidWeightInput('3.55kg')).toBe(false)
  })

  it('숫자가 아니면 거부한다', () => {
    expect(isValidWeightInput('삼점오')).toBe(false)
    expect(isValidWeightInput('3,5')).toBe(false)
    expect(isValidWeightInput('-3')).toBe(false)
  })
})

describe('toWeightPayload / toWeightInput', () => {
  it('빈 값은 null 로 보낸다 — 0 으로 채우지 않는다', () => {
    expect(toWeightPayload('')).toBeNull()
  })

  it('숫자로 바꿔 보낸다', () => {
    expect(toWeightPayload('3.5')).toBe(3.5)
    expect(toWeightPayload(' 12 ')).toBe(12)
  })

  it('null(모름)은 빈 입력으로 되돌아온다', () => {
    expect(toWeightInput(null)).toBe('')
  })

  it('왕복해도 값이 유지된다', () => {
    expect(toWeightPayload(toWeightInput(3.5))).toBe(3.5)
    expect(toWeightPayload(toWeightInput(null))).toBeNull()
  })
})

describe('toPlaceFilterWeight', () => {
  /**
   * 백엔드 조건은 `maxPetWeightKg >= petWeightKg` 이고 파라미터가 Integer 다.
   * 내림하면 못 가는 곳이 검색에 남는다 — 그쪽이 훨씬 비싼 오류다.
   */
  it('올림한다 — 내림하면 못 들어가는 곳이 통과한다', () => {
    expect(toPlaceFilterWeight(3.5)).toBe(4)
    expect(toPlaceFilterWeight(3.1)).toBe(4)
    expect(toPlaceFilterWeight(11.9)).toBe(12)
  })

  it('정수는 그대로 둔다 — 12kg 인 아이는 상한 12kg 인 곳에 들어간다', () => {
    expect(toPlaceFilterWeight(12)).toBe(12)
  })

  it('모르면 필터를 걸지 않는다 — 체중을 모른다고 후보를 좁히면 안 된다', () => {
    expect(toPlaceFilterWeight(null)).toBeNull()
  })

  it('0 이하는 값이 아니다', () => {
    expect(toPlaceFilterWeight(0)).toBeNull()
    expect(toPlaceFilterWeight(-1)).toBeNull()
  })
})
