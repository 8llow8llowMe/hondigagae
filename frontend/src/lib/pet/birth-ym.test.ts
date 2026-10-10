import { describe, expect, it } from 'vitest'

import { formatBirthYmInput, isValidBirthYmInput } from '@/lib/pet/birth-ym'

describe('formatBirthYmInput', () => {
  it('숫자만 쳐도 하이픈을 끼운다', () => {
    expect(formatBirthYmInput('202603')).toBe('2026-03')
    expect(formatBirthYmInput('201705')).toBe('2017-05')
  })

  it('입력 중인 값을 그대로 통과시킨다 — 4자리까지는 하이픈이 없다', () => {
    expect(formatBirthYmInput('')).toBe('')
    expect(formatBirthYmInput('2')).toBe('2')
    expect(formatBirthYmInput('2026')).toBe('2026')
    expect(formatBirthYmInput('20260')).toBe('2026-0')
  })

  it('하이픈을 지우다 걸리는 자리가 없다 — 매번 숫자에서 다시 만든다', () => {
    // `2026-0` 에서 백스페이스 → 브라우저가 넘기는 값은 `2026-`
    expect(formatBirthYmInput('2026-')).toBe('2026')
  })

  it('사람이 직접 넣은 구분자도 받는다', () => {
    expect(formatBirthYmInput('2026-03')).toBe('2026-03')
    expect(formatBirthYmInput('2026.03')).toBe('2026-03')
    expect(formatBirthYmInput('2026 03')).toBe('2026-03')
    expect(formatBirthYmInput('2026 / 03')).toBe('2026-03')
  })

  it('6자리를 넘는 숫자는 버린다', () => {
    expect(formatBirthYmInput('20260312')).toBe('2026-03')
  })

  it('월 값을 손대지 않는다 — 범위 판정은 스키마가 낸다', () => {
    expect(formatBirthYmInput('202613')).toBe('2026-13')
    expect(isValidBirthYmInput('2026-13')).toBe(false)
  })
})

describe('isValidBirthYmInput', () => {
  it('빈 값은 유효하다 — 선택 입력이다', () => {
    expect(isValidBirthYmInput('')).toBe(true)
    expect(isValidBirthYmInput('   ')).toBe(true)
  })

  it('yyyy-MM 만 통과한다 (PET_104)', () => {
    expect(isValidBirthYmInput('2017-05')).toBe(true)
    expect(isValidBirthYmInput('2017-00')).toBe(false)
    expect(isValidBirthYmInput('2017-5')).toBe(false)
    expect(isValidBirthYmInput('201705')).toBe(false)
  })

  it('마스크가 만든 값은 스키마를 통과한다 — 두 규칙이 어긋나면 안 된다', () => {
    expect(isValidBirthYmInput(formatBirthYmInput('202603'))).toBe(true)
  })
})
