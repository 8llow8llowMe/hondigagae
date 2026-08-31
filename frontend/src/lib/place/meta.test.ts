import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { placeMetaLine } from '@/lib/place/meta'

/**
 * 메타 줄 조립 — 이슈 #112.
 *
 * 목록 행 · 일정 항목 행 · AI 초안 항목 행이 이 한 줄을 공유한다. 조각이 하나만 남는
 * 경우(주소 없음 · 실내 여부 없음)에 **빈 구분자가 남지 않는 것**이 검증의 핵심이다.
 */
describe('placeMetaLine', () => {
  it('주소와 실내 여부를 구분자로 잇는다', () => {
    expect(placeMetaLine('제주특별자치도 제주시 한림읍 용금로 906-107', true)).toBe(
      `제주시 한림읍 · ${messages.place.rowIndoor}`,
    )
  })

  it('실내 여부를 모르면 주소만 남는다 — 구분자를 남기지 않는다', () => {
    expect(placeMetaLine('제주특별자치도 제주시 한림읍 용금로 906-107', null)).toBe('제주시 한림읍')
  })

  it('주소가 없으면 낱말만 남는다 — 구분자를 남기지 않는다', () => {
    expect(placeMetaLine(null, false)).toBe(messages.place.rowOutdoor)
  })

  it('둘 다 없으면 null 이다 — 호출부가 줄 자체를 지운다', () => {
    expect(placeMetaLine(null, null)).toBeNull()
  })

  it('주소가 짧은 주소로 줄지 않는 값이면 그것을 그대로 쓰지 않는다 — shortAddress 규칙을 따른다', () => {
    // 시·군·구·읍·면·동을 못 찾는 문자열은 shortAddress 가 null 을 준다.
    // 그때도 실내 낱말만으로 줄이 성립한다
    expect(placeMetaLine('', true)).toBe(messages.place.rowIndoor)
  })
})
