import { describe, expect, it } from 'vitest'

import { PRODUCTION_SITE_URL } from '@/lib/seo/site'
import {
  collectIndexablePlaceIds,
  collectWalkCourseIds,
  SITEMAP_MAX_PAGES,
  type SitemapFetcher,
  STATIC_PUBLIC_PATHS,
  toSitemap,
} from '@/lib/seo/sitemap'

type Page = { ids: string[]; hasNext: boolean }

/** 판정 코드별로 페이지를 차례로 내주는 대역. 받은 경로를 기록한다 */
function fakeFetcher(pages: Record<string, Page[] | Error>) {
  const calls: string[] = []
  const cursors: Record<string, number> = {}

  const fetcher: SitemapFetcher = <T>(path: string): Promise<T> => {
    calls.push(path)
    const code = new URLSearchParams(path.split('?')[1]).get('petAllowanceType') ?? ''
    const source = pages[code]
    if (source instanceof Error) return Promise.reject(source)

    const index = cursors[code] ?? 0
    cursors[code] = index + 1
    const page = source?.[index] ?? { ids: [], hasNext: false }

    return Promise.resolve({
      contents: page.ids.map((placeId) => ({ placeId })),
      hasNext: page.hasNext,
    } as T)
  }

  return { fetcher, calls }
}

describe('collectIndexablePlaceIds — #1130', () => {
  it('색인할 판정 셋만 각각 필터를 걸어 끝까지 돈다 — UNKNOWN 은 묻지 않는다', async () => {
    const { fetcher, calls } = fakeFetcher({
      ALLOWED: [
        { ids: ['1', '2'], hasNext: true },
        { ids: ['3'], hasNext: false },
      ],
      PARTIALLY_ALLOWED: [{ ids: ['4'], hasNext: false }],
      NOT_ALLOWED: [{ ids: ['5'], hasNext: false }],
    })

    expect(await collectIndexablePlaceIds(fetcher)).toEqual(['1', '2', '3', '4', '5'])
    expect(calls.some((path) => path.includes('UNKNOWN'))).toBe(false)
    expect(calls.every((path) => path.includes('size=50'))).toBe(true)
  })

  it('다음 페이지는 직전 마지막 id 를 커서로 보낸다', async () => {
    const { fetcher, calls } = fakeFetcher({
      ALLOWED: [
        { ids: ['1', '2'], hasNext: true },
        { ids: ['3'], hasNext: false },
      ],
    })

    await collectIndexablePlaceIds(fetcher)

    expect(calls[0]).not.toContain('lastPlaceId')
    expect(calls[1]).toContain('lastPlaceId=2')
  })

  it('한 판정이 실패해도 모은 것과 다른 판정은 남는다 — 사이트맵을 500 으로 만들지 않는다', async () => {
    const { fetcher } = fakeFetcher({
      ALLOWED: new Error('5xx'),
      NOT_ALLOWED: [{ ids: ['9'], hasNext: false }],
    })

    expect(await collectIndexablePlaceIds(fetcher)).toEqual(['9'])
  })

  it('커서가 제자리를 돌면 멈춘다', async () => {
    const { fetcher, calls } = fakeFetcher({
      ALLOWED: Array.from({ length: SITEMAP_MAX_PAGES + 5 }, () => ({ ids: ['7'], hasNext: true })),
    })

    await collectIndexablePlaceIds(fetcher)

    expect(calls.filter((path) => path.includes('=ALLOWED')).length).toBe(2)
  })
})

describe('collectWalkCourseIds', () => {
  it('목록 전량의 id', async () => {
    const fetcher: SitemapFetcher = <T>() =>
      Promise.resolve({ courses: [{ walkCourseId: 'a' }, { walkCourseId: 'b' }] } as T)

    expect(await collectWalkCourseIds(fetcher)).toEqual(['a', 'b'])
  })

  it('실패하면 빈 목록', async () => {
    const fetcher: SitemapFetcher = () => Promise.reject(new Error('5xx'))

    expect(await collectWalkCourseIds(fetcher)).toEqual([])
  })
})

describe('toSitemap', () => {
  const sitemap = toSitemap(PRODUCTION_SITE_URL, { placeIds: ['10'], walkCourseIds: ['20'] })
  const urls = sitemap.map((entry) => entry.url)

  it('정적 공개 화면 · 코스 · 장소를 절대 주소로 싣는다', () => {
    expect(urls).toEqual([
      ...STATIC_PUBLIC_PATHS.map((path) => new URL(path, PRODUCTION_SITE_URL).toString()),
      'https://www.hondigagae.com/olle/20',
      'https://www.hondigagae.com/places/10',
    ])
  })

  it('보호 화면을 싣지 않는다', () => {
    for (const path of ['/plans', '/mypage', '/pets', '/favorites', '/ai-plans', '/login']) {
      expect(urls.some((url) => new URL(url).pathname.startsWith(path))).toBe(false)
    }
  })
})
