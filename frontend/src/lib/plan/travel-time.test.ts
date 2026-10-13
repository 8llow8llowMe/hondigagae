import { describe, expect, it } from 'vitest'

import { travelDurationLabel } from '@/lib/plan/travel-time'

describe('travelDurationLabel — 직선거리로 어림한 이동 시간 (#1426)', () => {
  it('12km 는 약 30분 — 담기 시각을 잇는 근사(직선 × 1.3 ÷ 40km/h, 10분 올림)와 같은 값이다', () => {
    expect(travelDurationLabel(12_000)).toBe('30분')
  })

  it('한 시간을 넘으면 시간 · 분으로 적는다', () => {
    // 50km × 1.3 ÷ 40 = 97.5분 → 100분
    expect(travelDurationLabel(50_000)).toBe('1시간 40분')
  })

  it('아무리 가까워도 10분 — 주차 · 걸어서 입장', () => {
    expect(travelDurationLabel(300)).toBe('10분')
  })
})
