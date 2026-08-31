import { describe, expect, it } from 'vitest'

import { itemTypeLabel } from '@/lib/ai-plan/item-type'

describe('itemTypeLabel', () => {
  it('백엔드 PlanItemType 다섯 종의 표시명을 준다', () => {
    expect(itemTypeLabel('PLACE')).toBe('장소')
    expect(itemTypeLabel('MEAL')).toBe('식사')
    expect(itemTypeLabel('LODGING')).toBe('숙박')
    expect(itemTypeLabel('WALK')).toBe('산책')
    expect(itemTypeLabel('MOVE')).toBe('이동')
  })

  it('모르는 코드는 null 이다 — 화면에 코드 문자열을 노출하지 않는다', () => {
    expect(itemTypeLabel('CAFE')).toBeNull()
    expect(itemTypeLabel('')).toBeNull()
  })
})
