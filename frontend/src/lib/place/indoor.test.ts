import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { indoorLabel } from '@/lib/place/indoor'

/**
 * 실내 여부 낱말 — 이슈 #112.
 *
 * 규칙은 하나뿐이지만 그 하나가 자주 깨진다. `indoor` 는 `Boolean` 이라 `null` 이 오고,
 * `?? false` 나 `!indoor` 로 다루면 화면이 "야외" 라고 단정한다.
 */
describe('indoorLabel', () => {
  it('true 면 실내다', () => {
    expect(indoorLabel(true)).toBe(messages.place.rowIndoor)
  })

  it('false 면 야외다', () => {
    expect(indoorLabel(false)).toBe(messages.place.rowOutdoor)
  })

  it('null 은 야외가 아니라 낱말 없음이다 — "정보 없음" 과 "실외" 는 다르다', () => {
    expect(indoorLabel(null)).toBeNull()
    expect(indoorLabel(null)).not.toBe(messages.place.rowOutdoor)
  })
})
