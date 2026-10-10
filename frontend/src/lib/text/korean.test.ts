import { describe, expect, it } from 'vitest'

import {
  withCompanionParticle,
  withObjectParticle,
  withParenthesizedParticle,
  withSubjectParticle,
  withTopicParticle,
} from '@/lib/text/korean'

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

describe('withParenthesizedParticle — 괄호 뒤 조사', () => {
  it('받침은 괄호 앞이 아니라 **괄호 안** 마지막 글자로 판정한다', () => {
    // 이름은 받침이 없지만(갱얼쥐) 소리 내어 읽으면 조사 앞은 `견` 이다
    expect(withParenthesizedParticle('갱얼쥐', '소형견', withSubjectParticle)).toBe(
      '갱얼쥐(소형견)이',
    )
    expect(withParenthesizedParticle('몽실이', '소형견', withTopicParticle)).toBe(
      '몽실이(소형견)은',
    )
  })

  it('괄호 안에 받침이 없으면 그쪽을 따른다 — 이름의 받침을 보지 않는다', () => {
    expect(withParenthesizedParticle('곰', '푸들', withSubjectParticle)).toBe('곰(푸들)이')
    expect(withParenthesizedParticle('곰', '말티즈', withSubjectParticle)).toBe('곰(말티즈)가')
  })

  it('크기 이름 셋은 모두 받침으로 끝난다 — 고정 조사가 항상 틀렸던 이유다', () => {
    for (const size of ['소형견', '중형견', '대형견']) {
      expect(withParenthesizedParticle('초코', size, withSubjectParticle)).toBe(`초코(${size})이`)
    }
  })

  it('주석이 비면 괄호를 그리지 않고 이름을 기준으로 붙인다', () => {
    expect(withParenthesizedParticle('초코', '', withSubjectParticle)).toBe('초코가')
    expect(withParenthesizedParticle('곰', '   ', withSubjectParticle)).toBe('곰이')
  })

  it('이름이 비면 조사만 남기지 않는다 — 헬퍼가 빈 값을 그대로 돌려준다', () => {
    expect(withParenthesizedParticle('', '', withSubjectParticle)).toBe('')
  })
})
