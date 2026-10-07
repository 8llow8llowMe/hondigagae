import type { MetadataRoute } from 'next'

import { serverFetch } from '@/lib/api/server'
import { siteUrl } from '@/lib/seo/site'
import { collectIndexablePlaces, collectWalkCourseIds, toSitemap } from '@/lib/seo/sitemap'

/**
 * `/sitemap.xml` (#1130). 조립은 `lib/seo/sitemap.ts` 가 한다.
 *
 * **요청마다 만든다.** 정적으로 두면 `next build` 가 빌드 머신에서 백엔드를 불러야 하는데,
 * 빌드(x86 Jenkins)와 실행(라즈베리파이)이 다른 머신이라 빌드 시점 데이터가 배포 뒤까지
 * 남는다. 크롤러가 사이트맵을 읽는 것은 하루 몇 번이고 조회는 두 번(장소 전용 API · 올레 목록)이라
 * 부담이 없다(#1210 — 예전에는 장소 목록을 15번 안팎 돌았다).
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fetcher = <T>(path: string) => serverFetch<T>(path)

  const [places, walkCourseIds] = await Promise.all([
    collectIndexablePlaces(fetcher),
    collectWalkCourseIds(fetcher),
  ])

  return toSitemap(siteUrl(), { places, walkCourseIds })
}
