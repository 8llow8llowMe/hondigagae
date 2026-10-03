import { describe, expect, it } from 'vitest'

import {
  findLandingTopic,
  LANDING_PAGE_SIZE,
  LANDING_TOPICS,
  landingCopy,
  landingExplorerHref,
  landingListApiPath,
  landingPath,
  parseLandingCursor,
} from '@/lib/landing/topics'

const stays = findLandingTopic('pet-friendly-stays')!

describe('검색어 랜딩 주제 (#1134)', () => {
  it('세 주제의 slug 와 h1', () => {
    expect(LANDING_TOPICS.map((topic) => [topic.slug, landingCopy(topic).heading])).toEqual([
      ['pet-friendly-stays', '제주 애견동반 숙소'],
      ['pet-friendly-places', '제주 강아지랑 가볼만한 곳'],
      ['pet-friendly-restaurants', '제주 애견동반 식당·카페'],
    ])
  })

  it('모르는 slug 는 null — 라우트가 404 로 답한다', () => {
    expect(findLandingTopic('dog-hotel')).toBeNull()
  })

  it('조회는 제주 · 콘텐츠 타입 · ALLOWED 만 · 50개', () => {
    const query = new URLSearchParams(landingListApiPath(stays, null).split('?')[1])

    expect(Object.fromEntries(query)).toEqual({
      areaCode: '39',
      contentType: 'LODGING',
      petAllowanceType: 'ALLOWED',
      size: String(LANDING_PAGE_SIZE),
    })
  })

  it('다음 페이지 조회에 커서를 싣는다', () => {
    expect(landingListApiPath(stays, '123')).toContain('lastPlaceId=123')
  })

  it('화면 주소 — 첫 페이지는 쿼리 없이, 다음은 ?after=', () => {
    expect(landingPath(stays)).toBe('/jeju/pet-friendly-stays')
    expect(landingPath(stays, '123')).toBe('/jeju/pet-friendly-stays?after=123')
  })

  it.each([
    ['123', '123'],
    ['abc', null],
    [undefined, null],
    [['1', '2'], null],
  ] as const)('after=%j → %j — 장소 id 모양만 받는다', (raw, expected) => {
    expect(parseLandingCursor(raw as string | string[] | undefined)).toBe(expected)
  })

  it('장소 찾기 링크는 같은 조건의 목록 보기', () => {
    const href = landingExplorerHref(stays)

    expect(href.startsWith('/places?')).toBe(true)
    expect(href).toContain('contentType=LODGING')
    expect(href).toContain('petAllowanceType=ALLOWED')
    expect(href).toContain('view=list')
  })
})
