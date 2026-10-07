import { describe, expect, it } from 'vitest'

import { hoursHeadline } from './hours'

describe('hoursHeadline', () => {
  it('한 줄 원문은 그대로다 (dev 수월봉 `상시 개방`)', () => {
    expect(hoursHeadline('상시 개방')).toBe('상시 개방')
  })

  it('여러 줄이면 첫 줄만 — 나머지는 방문 정보 카드가 전문으로 말한다', () => {
    expect(hoursHeadline('09:00~18:00<br>(입장 마감 17:00)')).toBe('09:00~18:00')
  })

  it('빈 첫 줄은 건너뛴다', () => {
    expect(hoursHeadline('<br> \n월~금 09:00~18:00')).toBe('월~금 09:00~18:00')
  })

  it('없으면 null', () => {
    expect(hoursHeadline(null)).toBeNull()
    expect(hoursHeadline('  ')).toBeNull()
  })
})
