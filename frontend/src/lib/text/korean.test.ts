import { describe, expect, it } from 'vitest'

import { withCompanionParticle, withObjectParticle, withSubjectParticle } from '@/lib/text/korean'

describe('withObjectParticle (을/를)', () => {
  it('종성이 없으면 를 을 붙인다', () => {
    expect(withObjectParticle('몽실이')).toBe('몽실이를')
    expect(withObjectParticle('초코')).toBe('초코를')
    expect(withObjectParticle('두부')).toBe('두부를')
  })

  it('종성이 있으면 을 을 붙인다', () => {
    expect(withObjectParticle('곰')).toBe('곰을')
    expect(withObjectParticle('바둑')).toBe('바둑을')
    expect(withObjectParticle('ハ')).toBe('ハ를')
  })

  it('한글이 아닌 끝 글자는 를 로 떨어진다', () => {
    expect(withObjectParticle('Bob')).toBe('Bob를')
    expect(withObjectParticle('7')).toBe('7를')
  })

  it('빈 문자열은 조사를 붙이지 않는다', () => {
    expect(withObjectParticle('')).toBe('')
    expect(withObjectParticle('   ')).toBe('   ')
  })
})

describe('withSubjectParticle (이/가)', () => {
  it('종성 유무로 갈린다', () => {
    expect(withSubjectParticle('몽실이')).toBe('몽실이가')
    expect(withSubjectParticle('곰')).toBe('곰이')
  })
})

describe('withCompanionParticle', () => {
  it('받침이 없으면 "와" 를 붙인다', () => {
    expect(withCompanionParticle('몽실이')).toBe('몽실이와')
    expect(withCompanionParticle('초코')).toBe('초코와')
  })

  it('받침이 있으면 "과" 를 붙인다 — 을/를·이/가와 규칙이 반대다', () => {
    expect(withCompanionParticle('곰')).toBe('곰과')
    expect(withCompanionParticle('방울')).toBe('방울과')
  })

  it('한글이 아니면 받침 없음으로 본다', () => {
    expect(withCompanionParticle('Bori')).toBe('Bori와')
  })

  it('빈 이름에는 아무것도 붙이지 않는다', () => {
    expect(withCompanionParticle('')).toBe('')
  })
})
