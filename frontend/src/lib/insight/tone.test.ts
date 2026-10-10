import { describe, expect, it } from 'vitest'

import { congestionTone, suitabilityTone, walkSafetyTone } from '@/lib/insight/tone'

describe('suitabilityTone', () => {
  it('서버 등급 코드를 톤으로 옮긴다', () => {
    expect(suitabilityTone('HIGH')).toBe('high')
    expect(suitabilityTone('MEDIUM')).toBe('mid')
    expect(suitabilityTone('LOW')).toBe('low')
  })

  it('INSUFFICIENT 는 unknown 이다 — 모르는 것은 나쁜 것이 아니다', () => {
    expect(suitabilityTone('INSUFFICIENT')).toBe('unknown')
  })

  it('모르는 코드·null 은 unknown 으로 떨어진다', () => {
    expect(suitabilityTone('WHATEVER')).toBe('unknown')
    expect(suitabilityTone(null)).toBe('unknown')
    expect(suitabilityTone(undefined)).toBe('unknown')
  })
})

describe('walkSafetyTone', () => {
  it('적합도와 다른 코드 체계를 쓴다', () => {
    expect(walkSafetyTone('SAFE')).toBe('high')
    expect(walkSafetyTone('CAUTION')).toBe('mid')
  })

  it('DANGER 는 critical 이다 — 산책 위험은 실제로 다치는 일이다', () => {
    expect(walkSafetyTone('DANGER')).toBe('critical')
  })

  it('적합도 코드를 넣으면 unknown 이다 — 축을 섞어 쓸 수 없다', () => {
    expect(walkSafetyTone('HIGH')).toBe('unknown')
    expect(walkSafetyTone('MEDIUM')).toBe('unknown')
  })

  it('UNKNOWN·null 은 unknown 이다', () => {
    expect(walkSafetyTone('UNKNOWN')).toBe('unknown')
    expect(walkSafetyTone(null)).toBe('unknown')
  })
})

describe('congestionTone — 적합도와 의미가 뒤집힌다', () => {
  it('LOW(한산)는 좋은 쪽이라 high 다', () => {
    expect(congestionTone('LOW')).toBe('high')
  })

  it('HIGH(혼잡)는 나쁜 쪽이라 low 다', () => {
    expect(congestionTone('HIGH')).toBe('low')
  })

  it('혼잡을 critical 로 올리지 않는다 — 붐비는 것은 위험이 아니라 조건이다', () => {
    expect(congestionTone('HIGH')).not.toBe('critical')
  })

  it('MODERATE 는 mid, UNKNOWN 은 unknown 이다', () => {
    expect(congestionTone('MODERATE')).toBe('mid')
    expect(congestionTone('UNKNOWN')).toBe('unknown')
  })

  it('같은 문자열이 축에 따라 반대 톤이 된다', () => {
    // 이 단언이 공용 매퍼를 쓰면 안 되는 이유 그 자체다
    expect(congestionTone('LOW')).not.toBe(suitabilityTone('LOW'))
    expect(congestionTone('HIGH')).not.toBe(suitabilityTone('HIGH'))
  })
})
