import type { MetadataRoute } from 'next'

import { paths } from '@/lib/api/paths'
import { walkCourseListPath } from '@/lib/api/walk-course'
import { LANDING_TOPICS, landingPath } from '@/lib/landing/topics'
import { INDEXABLE_PET_ALLOWANCES } from '@/lib/seo/place'
import { absoluteUrl } from '@/lib/seo/site'
import type { PlaceSitemapResult } from '@/types/place'
import type { WalkCourseList } from '@/types/walk-course'

/**
 * `sitemap.xml` 조립 (#1130).
 *
 * **크롤러가 링크로 닿지 못하는 장소를 여기서 알린다.** 장소 목록은 무한 스크롤이라 서버 렌더
 * HTML 에 든 장소는 첫 20곳뿐이다. 나머지는 사이트맵이 없으면 검색엔진이 알 방법이 없다.
 *
 * **조회 함수를 주입받는다.** `serverFetch` 는 `server-only` 라 여기서 바로 부르면 테스트에서
 * 대역을 끼울 수 없다 — 판정 거르기 · 수정일 변환 · 실패 처리가 이 파일의 핵심이라 그 부분을 잠가야 한다.
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

/** 사이트맵에 실을 장소 하나. `lastModified` 는 수정일을 읽을 수 있을 때만 있다 */
export type SitemapPlace = {
  placeId: string
  lastModified?: string
}

const INDEXABLE = new Set<string>(INDEXABLE_PET_ALLOWANCES)

/** 백엔드 `LocalDateTime` 직렬화 — 초 · 소수부는 있을 수도 없을 수도 있다. 오프셋은 없다 */
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

/**
 * 원천 수정일 → `<lastmod>` (#1210).
 *
 * **`+09:00` 을 붙인다.** 서버가 주는 값은 오프셋 없는 KST `LocalDateTime` 인데, 그대로 실으면
 * 검색엔진이 UTC 로 읽어 9시간 어긋난다. W3C Datetime 은 초 없는 `hh:mm` 도 받는다.
 *
 * **모양이 다르면 싣지 않는다** — 이미 오프셋이 붙었거나 날짜만 오면 계약이 바뀐 것이고, 거기에
 * 오프셋을 또 붙이면 잘못된 날짜가 된다. 틀린 `lastmod` 보다 없는 쪽이 낫다(검색엔진은 없으면
 * 스스로 판단한다). `null`(원천에 수정일 없음)도 생략이다.
 */
export function toLastModified(modifiedAt: string | null): string | undefined {
  if (modifiedAt === null || !LOCAL_DATE_TIME.test(modifiedAt)) return undefined
  return `${modifiedAt}+09:00`
}

/**
 * 색인할 장소 (#1130 → #1210).
 *
 * **사이트맵 전용 API 한 번이다** (`/places/sitemap`, BE #1135). 예전에는 목록 API(size ≤ 50 커서)를
 * 동반 판정 셋 × 페이지로 돌아 14번 안팎 불렀고, 장소가 늘수록 비례해 늘었다. 전용 API 는 노출
 * 가능한 장소 전량(병합 · delisted 제외)을 세 필드로 한 번에 준다 — 제주 2,300여 곳이 압축 전 약 0.5MB.
 *
 * **동반 판정은 여기서 거른다.** 서버는 판정으로 거르지 않는다 — 색인 대상(`INDEXABLE_PET_ALLOWANCES`)은
 * 상세 `robots` 와 같은 목록 하나라 FE 가 쥔다(`lib/seo/place.ts`).
 *
 * **실패하면 빈 목록이다.** 사이트맵이 500 이면 검색엔진이 정적 화면까지 못 읽는다. 예전처럼
 * "모은 데까지" 는 없다 — 한 번의 호출이라 부분이 없다. 하루 안에 다시 읽힌다.
 */
export async function collectIndexablePlaces(fetcher: SitemapFetcher): Promise<SitemapPlace[]> {
  let result: PlaceSitemapResult
  try {
    result = await fetcher<PlaceSitemapResult>(paths.places.sitemap)
  } catch {
    return []
  }

  const seen = new Set<string>()
  const places: SitemapPlace[] = []
  for (const item of result.places) {
    if (!INDEXABLE.has(item.petAllowanceType.code) || seen.has(item.placeId)) continue
    seen.add(item.placeId)

    const lastModified = toLastModified(item.modifiedAt)
    places.push(
      lastModified === undefined
        ? { placeId: item.placeId }
        : { placeId: item.placeId, lastModified },
    )
  }
  return places
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
  { places, walkCourseIds }: { places: SitemapPlace[]; walkCourseIds: string[] },
): MetadataRoute.Sitemap {
  return [
    ...STATIC_PUBLIC_PATHS.map((path) => ({
      url: absoluteUrl(path, base),
      changeFrequency: 'daily' as const,
    })),
    // 검색어 랜딩 첫 페이지 (#1134). 다음 페이지는 랜딩 안 링크로 닿는다
    ...LANDING_TOPICS.map((topic) => ({
      url: absoluteUrl(landingPath(topic), base),
      changeFrequency: 'daily' as const,
    })),
    ...walkCourseIds.map((id) => ({
      url: absoluteUrl(`/olle/${id}`, base),
      changeFrequency: 'monthly' as const,
    })),
    ...places.map(({ placeId, lastModified }) => ({
      url: absoluteUrl(`/places/${placeId}`, base),
      // 수정일을 모르면 키를 싣지 않는다 — 빈 `<lastmod>` 를 내지 않게
      ...(lastModified === undefined ? {} : { lastModified }),
      changeFrequency: 'weekly' as const,
    })),
  ]
}
