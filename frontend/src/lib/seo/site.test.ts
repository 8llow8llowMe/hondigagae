import { describe, expect, it } from 'vitest'

import { absoluteUrl, isProductionSite, PRODUCTION_SITE_URL } from '@/lib/seo/site'

describe('isProductionSite — 운영 도메인만 색인한다 (#1130)', () => {
  it.each([
    ['https://www.hondigagae.com', true],
    ['https://www.hondigagae.com/', true],
    ['https://dev.hondigagae.com', false],
    ['https://hondigagae.com', false],
    ['http://www.hondigagae.com', false],
    ['http://localhost:3000', false],
    ['주소가 아님', false],
  ])('%s → %s', (url, expected) => {
    expect(isProductionSite(url)).toBe(expected)
  })
})

describe('absoluteUrl', () => {
  it('상대 경로에 도메인을 붙인다', () => {
    expect(absoluteUrl('/places/1', PRODUCTION_SITE_URL)).toBe(
      'https://www.hondigagae.com/places/1',
    )
  })
})
