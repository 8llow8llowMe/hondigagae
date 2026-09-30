import { describe, expect, it } from 'vitest'

import { formatCelsius, formatStandaloneCelsius } from '@/lib/format/celsius'

describe('formatCelsius', () => {
  it('소수점 1자리를 유지한다 — 자릿수가 흔들리면 값을 비교할 수 없다', () => {
    expect(formatCelsius(35)).toBe('35.0')
    expect(formatCelsius(52.4)).toBe('52.4')
    expect(formatCelsius(58.06)).toBe('58.1')
  })

  it('단위를 붙이지 않는다 — 호출부가 값과 단위를 분리해 그린다', () => {
    expect(formatCelsius(31)).not.toContain('℃')
  })

  it('null 을 그대로 돌려준다 — 호출부가 줄을 숨긴다', () => {
    expect(formatCelsius(null)).toBeNull()
    expect(formatCelsius(undefined)).toBeNull()
  })

  it('0도를 값으로 취급한다 — 없는 것과 다르다', () => {
    expect(formatCelsius(0)).toBe('0.0')
  })

  it('음수를 견딘다', () => {
    expect(formatCelsius(-3.5)).toBe('-3.5')
  })

  it('NaN·Infinity 는 null 이다', () => {
    expect(formatCelsius(Number.NaN)).toBeNull()
    expect(formatCelsius(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('formatStandaloneCelsius — 혼자 서는 값 (#1067)', () => {
  it('정수면 소수점을 뗀다 — 홀로 선 큰 숫자의 `.0` 은 읽기를 방해한다', () => {
    expect(formatStandaloneCelsius(33)).toBe('33')
    expect(formatStandaloneCelsius(58.0)).toBe('58')
  })

  it('소수가 의미 있는 값은 1자리를 그대로 둔다', () => {
    expect(formatStandaloneCelsius(27.5)).toBe('27.5')
    expect(formatStandaloneCelsius(33.4)).toBe('33.4')
  })

  it('먼저 1자리로 반올림하고 그 값으로 판정한다 — `35.96` 은 `36.0` 이 아니라 `36` 이다', () => {
    expect(formatStandaloneCelsius(35.96)).toBe('36')
    expect(formatStandaloneCelsius(58.06)).toBe('58.1')
    expect(formatStandaloneCelsius(24.04)).toBe('24')
  })

  it('0도를 값으로 취급한다 — `-0` 으로 새지 않는다', () => {
    expect(formatStandaloneCelsius(0)).toBe('0')
    expect(formatStandaloneCelsius(-0.04)).toBe('0')
  })

  it('음수를 견딘다', () => {
    expect(formatStandaloneCelsius(-3)).toBe('-3')
    expect(formatStandaloneCelsius(-3.5)).toBe('-3.5')
  })

  it('단위를 붙이지 않는다 — formatCelsius 와 같은 계약이다', () => {
    expect(formatStandaloneCelsius(31)).not.toContain('℃')
  })

  it('null · undefined · NaN · Infinity 는 null 이다 — 호출부가 줄을 숨긴다', () => {
    expect(formatStandaloneCelsius(null)).toBeNull()
    expect(formatStandaloneCelsius(undefined)).toBeNull()
    expect(formatStandaloneCelsius(Number.NaN)).toBeNull()
    expect(formatStandaloneCelsius(Number.NEGATIVE_INFINITY)).toBeNull()
  })
})
