import { describe, expect, it } from 'vitest'

import { meaningfulOverview } from './overview'

describe('meaningfulOverview', () => {
  it('분류명과 같은 한 낱말은 소개가 아니다 (#1216 — dev 수월봉 `관광지`)', () => {
    expect(meaningfulOverview('관광지', ['관광지', '여행지'])).toBeNull()
  })

  it('원천 분류와 같은 낱말도 걸러진다 (dev `박물관` / 문화시설 · 박물관)', () => {
    expect(meaningfulOverview('박물관', ['문화시설', '박물관'])).toBeNull()
  })

  it('태그 · 공백을 걷은 뒤에 비교한다', () => {
    expect(meaningfulOverview('  <p>관광지</p> ', ['관광지', null])).toBeNull()
  })

  it('분류명을 포함한 문장은 남긴다 — 정확히 같을 때만 거른다', () => {
    expect(meaningfulOverview('바다를 낀 관광지', ['관광지', null])).toBe('바다를 낀 관광지')
  })

  it('분류와 다른 짧은 낱말은 남긴다 — 길이로 짐작하지 않는다', () => {
    expect(meaningfulOverview('오름', ['관광지', '여행지'])).toBe('오름')
  })

  it('비었거나 null 이면 null', () => {
    expect(meaningfulOverview(null, ['관광지', null])).toBeNull()
    expect(meaningfulOverview('<br>', ['관광지', null])).toBeNull()
  })
})
