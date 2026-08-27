import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { copyrightLabel } from '@/lib/place/copyright'

describe('copyrightLabel — cpyrhtDivCd 표시', () => {
  it('Type1 을 공공누리 제1유형으로 표시한다', () => {
    expect(copyrightLabel('Type1')).toBe(messages.place.detailCopyrightType1)
  })

  it('Type3 을 공공누리 제3유형으로 표시한다', () => {
    expect(copyrightLabel('Type3')).toBe(messages.place.detailCopyrightType3)
  })

  it('모르는 코드에서도 화면이 비지 않도록 기본 문구로 떨어진다', () => {
    expect(copyrightLabel('Type9')).toBe(messages.place.detailCopyrightUnknown)
  })

  it('값이 없으면 null 이다 — 출처 표기 줄 자체를 숨긴다', () => {
    expect(copyrightLabel(null)).toBeNull()
    expect(copyrightLabel('  ')).toBeNull()
  })
})
