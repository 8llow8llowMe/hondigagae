import type { MetadataRoute } from 'next'

import { paths } from '@/lib/api/paths'
import { walkCourseListPath } from '@/lib/api/walk-course'
import { INDEXABLE_PET_ALLOWANCES } from '@/lib/seo/place'
import { absoluteUrl } from '@/lib/seo/site'
import { DEFAULT_PLACE_FILTERS, toPlaceApiQuery } from '@/lib/url/place-filters'
import type { SliceResponse } from '@/types/api'
import type { PlaceSummary } from '@/types/place'
import type { WalkCourseList } from '@/types/walk-course'

/**
 * `sitemap.xml` 조립 (#1130).
 *
 * **크롤러가 링크로 닿지 못하는 장소를 여기서 알린다.** 장소 목록은 무한 스크롤이라 서버 렌더
 * HTML 에 든 장소는 첫 20곳뿐이다. 나머지는 사이트맵이 없으면 검색엔진이 알 방법이 없다.
 *
 * **조회 함수를 주입받는다.** `serverFetch` 는 `server-only` 라 여기서 바로 부르면 테스트에서
 * 대역을 끼울 수 없다 — 페이지 순회·실패 처리가 이 파일의 핵심이라 그 부분을 잠가야 한다.
 */
export type SitemapFetcher = <T>(path: string) => Promise<T>

/** 로그인 없이 열리는 화면. 보호 경로는 `/login` 으로 307 이라 싣지 않는다 */
export const STATIC_PUBLIC_PATHS = [
  '/',
  '/places',
  '/olle',
  '/emergency',
  '/about',
  '/terms',
  '/privacy',
] as const

/** 백엔드 `@Max(50)` */
export const SITEMAP_PAGE_SIZE = 50

/**
 * 동반 판정 하나당 페이지 상한. 커서가 제자리를 돌아도(`hasNext` 인데 같은 마지막 id) 끝나게
 * 하는 안전장치다. 50 × 200 = 1만 곳 — 지금 데이터(판정별 최대 535곳)의 스무 배 가까운 여유다.
 */
export const SITEMAP_MAX_PAGES = 200

/**
 * 색인할 장소 id. **판정별로 필터를 걸어 돈다** — 전량을 돌고 걸러 내면 2,323곳을 47번에 받지만,
 * 색인 대상(638곳)만 받으면 14번 안팎이다.
 *
 * **실패하면 그때까지 모은 것을 돌려준다.** 사이트맵이 500 이면 검색엔진이 정적 화면까지
 * 못 읽는다. 일부라도 내는 쪽이 낫고, 하루 안에 다시 읽힌다.
 */
export async function collectIndexablePlaceIds(fetcher: SitemapFetcher): Promise<string[]> {
  const ids = new Set<string>()

  for (const petAllowanceType of INDEXABLE_PET_ALLOWANCES) {
    const filters = { ...DEFAULT_PLACE_FILTERS, petAllowanceType }
    let cursor: string | null = null

    try {
      for (let page = 0; page < SITEMAP_MAX_PAGES; page += 1) {
        const slice: SliceResponse<PlaceSummary> = await fetcher(
          paths.places.list(toPlaceApiQuery(filters, cursor, SITEMAP_PAGE_SIZE)),
        )
        for (const place of slice.contents) ids.add(place.placeId)

        const last = slice.contents.at(-1)?.placeId ?? null
        if (!slice.hasNext || last === null || last === cursor) break
        cursor = last
      }
    } catch {
      // 이 판정의 나머지는 다음 재생성에 맡긴다. 다른 판정은 계속 돈다
    }
  }

  return [...ids]
}

/** 올레 코스는 커서가 없다 — 한 번에 전량이 온다 */
export async function collectWalkCourseIds(fetcher: SitemapFetcher): Promise<string[]> {
  try {
    const list = await fetcher<WalkCourseList>(
      walkCourseListPath({ petActivityLevel: null, sort: null }),
    )
    return list.courses.map((course) => course.walkCourseId)
  } catch {
    return []
  }
}

export function toSitemap(
  base: string,
  { placeIds, walkCourseIds }: { placeIds: string[]; walkCourseIds: string[] },
): MetadataRoute.Sitemap {
  return [
    ...STATIC_PUBLIC_PATHS.map((path) => ({
      url: absoluteUrl(path, base),
      changeFrequency: 'daily' as const,
    })),
    ...walkCourseIds.map((id) => ({
      url: absoluteUrl(`/olle/${id}`, base),
      changeFrequency: 'monthly' as const,
    })),
    ...placeIds.map((id) => ({
      url: absoluteUrl(`/places/${id}`, base),
      changeFrequency: 'weekly' as const,
    })),
  ]
}
