import { describe, expect, it } from 'vitest'

import { toPlainText } from '@/lib/place/text'

describe('toPlainText — 외부 원문 HTML 정규화', () => {
  it('br 태그를 개행으로 바꾼다', () => {
    expect(toPlainText('첫째 줄<br>둘째 줄')).toBe('첫째 줄\n둘째 줄')
  })

  it('자체 닫힘·대문자 br 도 개행으로 바꾼다', () => {
    expect(toPlainText('첫째<BR/>둘째<br />셋째')).toBe('첫째\n둘째\n셋째')
  })

  it('나머지 태그는 제거하고 안의 텍스트만 남긴다', () => {
    expect(toPlainText('<p><strong>천지연폭포</strong> 안내</p>')).toBe('천지연폭포 안내')
  })

  it('HTML 엔티티를 되돌린다', () => {
    expect(toPlainText('제주&nbsp;여행 &amp; 산책')).toBe('제주 여행 & 산책')
  })

  it('엔티티는 태그 제거 뒤에 되돌린다 — 태그로 재해석되지 않는다', () => {
    expect(toPlainText('&lt;script&gt;')).toBe('<script>')
  })

  it('개행을 유지한다', () => {
    expect(toPlainText('첫째\r\n둘째')).toBe('첫째\n둘째')
  })

  it('태그만 있거나 비어 있으면 null 이다 — 섹션을 숨기기 위해서다', () => {
    expect(toPlainText('<p></p>')).toBeNull()
    expect(toPlainText('   ')).toBeNull()
    expect(toPlainText('')).toBeNull()
  })

  it('null 은 null 이다', () => {
    expect(toPlainText(null)).toBeNull()
  })
})
