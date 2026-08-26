import { describe, expect, it } from 'vitest'

import { formatDistance } from '@/lib/format/distance'
import { formatDuration } from '@/lib/format/duration'
import { formatTemperature } from '@/lib/format/temperature'

describe('formatDistance', () => {
  it('1km 미만은 m 로 표기한다', () => {
    expect(formatDistance(999)).toBe('999m')
  })

  it('1km 이상은 소수 1자리 km 로 표기한다', () => {
    expect(formatDistance(1200)).toBe('1.2km')
  })

  it('정확히 1000m 는 km 로 표기한다', () => {
    expect(formatDistance(1000)).toBe('1.0km')
  })

  it('null 에는 대시를 반환한다', () => {
    expect(formatDistance(null)).toBe('-')
  })

  it('음수에는 대시를 반환한다', () => {
    expect(formatDistance(-5)).toBe('-')
  })
})

describe('formatTemperature', () => {
  it('℃ 단위를 붙여 표기한다', () => {
    expect(formatTemperature(24)).toBe('24℃')
  })

  it('소수는 반올림한다', () => {
    expect(formatTemperature(23.6)).toBe('24℃')
  })

  it('영하도 표기한다', () => {
    expect(formatTemperature(-3)).toBe('-3℃')
  })

  it('null 에는 대시를 반환한다', () => {
    expect(formatTemperature(null)).toBe('-')
  })
})

describe('formatDuration', () => {
  it('60분 미만은 분으로 표기한다', () => {
    expect(formatDuration(45)).toBe('45분')
  })

  it('정확히 나누어지면 시간만 표기한다', () => {
    expect(formatDuration(120)).toBe('2시간')
  })

  it('시간과 분을 함께 표기한다', () => {
    expect(formatDuration(95)).toBe('1시간 35분')
  })

  it('null 에는 대시를 반환한다', () => {
    expect(formatDuration(null)).toBe('-')
  })
})
