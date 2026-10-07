import { describe, expect, it } from 'vitest'

import { PRODUCTION_SITE_URL } from '@/lib/seo/site'
import {
  collectIndexablePlaces,
  collectWalkCourseIds,
  type SitemapFetcher,
  STATIC_PUBLIC_PATHS,
  toSitemap,
} from '@/lib/seo/sitemap'

type Entry = {
  placeId: string
  code: string
  modifiedAt?: string | null
}

/** `/places/sitemap` 응답을 내주는 대역. 받은 경로를 기록한다 */
function sitemapFetcher(entries: Entry[] | Error) {
  const calls: string[] = []

  const fetcher: SitemapFetcher = <T>(path: string): Promise<T> => {
    calls.push(path)
    if (entries instanceof Error) return Promise.reject(entries)

    const places = entries.map(({ placeId, code, modifiedAt = null }) => ({
      placeId,
      petAllowanceType: { code, name: code, description: null },
      modifiedAt,
    }))
    return Promise.resolve({ places, totalCount: places.length } as T)
  }

  return { fetcher, calls }
}

describe('collectIndexablePlaces — #1210', () => {
  it('사이트맵 전용 API 를 한 번만 부른다 — 판정별 · 페이지별로 돌지 않는다', async () => {
    const { fetcher, calls } = sitemapFetcher([{ placeId: '1', code: 'ALLOWED' }])

    await collectIndexablePlaces(fetcher)

    expect(calls).toEqual(['/places/sitemap'])
  })

  it('색인할 판정 셋만 남긴다 — UNKNOWN 은 뺀다', async () => {
    const { fetcher } = sitemapFetcher([
      { placeId: '1', code: 'ALLOWED' },
      { placeId: '2', code: 'UNKNOWN' },
      { placeId: '3', code: 'PARTIALLY_ALLOWED' },
      { placeId: '5', code: 'NOT_ALLOWED' },
    ])

    const places = await collectIndexablePlaces(fetcher)

    expect(places.map((place) => place.placeId)).toEqual(['1', '3', '5'])
  })

  /*
    **`modifiedAt` 은 오프셋 없는 KST `LocalDateTime` 이다.** 그대로 실으면 검색엔진이 UTC 로
    읽어 9시간 어긋난다 — `+09:00` 을 붙인다.
  */
  it('수정일에 KST 오프셋을 붙여 lastModified 로 싣는다', async () => {
    const { fetcher } = sitemapFetcher([
      { placeId: '1', code: 'ALLOWED', modifiedAt: '2026-08-27T14:30:05' },
      { placeId: '2', code: 'ALLOWED', modifiedAt: '2026-08-27T14:30:05.123456' },
      { placeId: '3', code: 'ALLOWED', modifiedAt: '2026-08-27T14:30' },
    ])

    const places = await collectIndexablePlaces(fetcher)

    expect(places.map((place) => place.lastModified)).toEqual([
      '2026-08-27T14:30:05+09:00',
      '2026-08-27T14:30:05.123456+09:00',
      '2026-08-27T14:30+09:00',
    ])
  })

  it('수정일이 없거나 읽을 수 없으면 lastModified 를 생략한다', async () => {
    const { fetcher } = sitemapFetcher([
      { placeId: '1', code: 'ALLOWED', modifiedAt: null },
      // 이미 오프셋이 붙은 값에 또 붙이면 잘못된 날짜가 된다 — 계약이 바뀐 것이니 싣지 않는다
      { placeId: '2', code: 'ALLOWED', modifiedAt: '2026-08-27T14:30:05+09:00' },
      { placeId: '3', code: 'ALLOWED', modifiedAt: '2026-08-27' },
    ])

    const places = await collectIndexablePlaces(fetcher)

    expect(places).toEqual([{ placeId: '1' }, { placeId: '2' }, { placeId: '3' }])
  })

  it('실패하면 빈 목록이다 — 사이트맵을 500 으로 만들지 않는다', async () => {
    const { fetcher } = sitemapFetcher(new Error('5xx'))

    expect(await collectIndexablePlaces(fetcher)).toEqual([])
  })

  it('같은 id 가 두 번 와도 한 번만 싣는다', async () => {
    const { fetcher } = sitemapFetcher([
      { placeId: '1', code: 'ALLOWED' },
      { placeId: '1', code: 'ALLOWED' },
    ])

    expect(await collectIndexablePlaces(fetcher)).toEqual([{ placeId: '1' }])
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
  const sitemap = toSitemap(PRODUCTION_SITE_URL, {
    places: [{ placeId: '10', lastModified: '2026-08-27T14:30:05+09:00' }, { placeId: '11' }],
    walkCourseIds: ['20'],
  })
  const urls = sitemap.map((entry) => entry.url)

  it('정적 공개 화면 · 검색어 랜딩 · 코스 · 장소를 절대 주소로 싣는다', () => {
    expect(urls).toEqual([
      ...STATIC_PUBLIC_PATHS.map((path) => new URL(path, PRODUCTION_SITE_URL).toString()),
      'https://www.hondigagae.com/jeju/pet-friendly-stays',
      'https://www.hondigagae.com/jeju/pet-friendly-places',
      'https://www.hondigagae.com/jeju/pet-friendly-restaurants',
      'https://www.hondigagae.com/olle/20',
      'https://www.hondigagae.com/places/10',
      'https://www.hondigagae.com/places/11',
    ])
  })

  it('장소의 수정일은 lastModified 로, 없으면 키 자체를 싣지 않는다', () => {
    const place = (id: string) => sitemap.find((entry) => entry.url.endsWith(`/places/${id}`))

    expect(place('10')?.lastModified).toBe('2026-08-27T14:30:05+09:00')
    expect(place('11')).not.toHaveProperty('lastModified')
  })

  it('보호 화면을 싣지 않는다', () => {
    for (const path of ['/plans', '/mypage', '/pets', '/favorites', '/ai-plans', '/login']) {
      expect(urls.some((url) => new URL(url).pathname.startsWith(path))).toBe(false)
    }
  })
})
