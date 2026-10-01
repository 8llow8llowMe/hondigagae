import { describe, expect, it } from 'vitest'

import {
  normalizeVerificationCode,
  normalizeVerificationCodeInput,
  VERIFICATION_CODE_LENGTH,
} from '@/lib/auth/verification-code'

describe('normalizeVerificationCode', () => {
  it('소문자를 대문자로 바꾼다 — 백엔드는 대문자로만 만들고 대소문자를 가려 비교한다', () => {
    expect(normalizeVerificationCode('a3k7mp2x')).toBe('A3K7MP2X')
  })

  it('앞뒤 · 가운데 공백을 모두 지운다 (메일에서 복사할 때 딸려 온다)', () => {
    expect(normalizeVerificationCode(' a3k7 mp2x ')).toBe('A3K7MP2X')
  })

  it('탭 · 줄바꿈 · 전각 공백도 공백으로 본다', () => {
    expect(normalizeVerificationCode('A3K7\tMP\n2X　')).toBe('A3K7MP2X')
  })

  it('공백을 지운 뒤 8자까지만 남긴다 — 자르기가 정규화보다 먼저면 붙여넣은 코드가 잘린다', () => {
    expect(VERIFICATION_CODE_LENGTH).toBe(8)
    expect(normalizeVerificationCode('  a3k7 mp2x  ')).toBe('A3K7MP2X')
    expect(normalizeVerificationCode('A3K7MP2XQ')).toBe('A3K7MP2X')
  })

  it('이미 정규화된 값은 그대로다 (멱등)', () => {
    expect(normalizeVerificationCode('A3K7MP2X')).toBe('A3K7MP2X')
    expect(normalizeVerificationCode(normalizeVerificationCode(' a3k7 '))).toBe('A3K7')
  })

  it('빈 값과 공백뿐인 값은 빈 문자열이다', () => {
    expect(normalizeVerificationCode('')).toBe('')
    expect(normalizeVerificationCode('   ')).toBe('')
  })
})

describe('normalizeVerificationCodeInput — 커서 위치', () => {
  it('끝에서 치면 커서도 끝이다', () => {
    expect(normalizeVerificationCodeInput('a3k', 3)).toEqual({ value: 'A3K', caret: 3 })
  })

  it('가운데에 친 글자 바로 뒤에 커서가 남는다 — 값을 바꿔 써도 끝으로 튀지 않는다', () => {
    // 'AB|CD' 에서 x 를 치면 브라우저 값은 'ABxCD', 커서 3
    expect(normalizeVerificationCodeInput('ABxCD', 3)).toEqual({ value: 'ABXCD', caret: 3 })
  })

  it('커서 앞의 공백이 지워진 만큼 커서가 당겨진다', () => {
    // 'AB|CD' 에서 스페이스를 치면 'AB CD', 커서 3 → 값 'ABCD', 커서 2
    expect(normalizeVerificationCodeInput('AB CD', 3)).toEqual({ value: 'ABCD', caret: 2 })
  })

  it('붙여넣기로 공백이 섞여 들어와도 커서는 붙여넣은 끝이다', () => {
    expect(normalizeVerificationCodeInput(' a3k7 mp2x ', 11)).toEqual({
      value: 'A3K7MP2X',
      caret: 8,
    })
  })

  it('8자를 넘긴 자리에서도 커서가 값 길이를 넘지 않는다', () => {
    expect(normalizeVerificationCodeInput('A3K7MP2XQ', 9)).toEqual({ value: 'A3K7MP2X', caret: 8 })
  })

  it('커서를 모르면(null) 커서도 null 이다', () => {
    expect(normalizeVerificationCodeInput('a b', null)).toEqual({ value: 'AB', caret: null })
  })
})
