import { describe, expect, it } from 'vitest'

import { formatCelsius } from '@/lib/format/celsius'

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
