import { describe, expect, it } from 'vitest'

import { withObjectParticle, withSubjectParticle } from '@/lib/text/korean'

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
