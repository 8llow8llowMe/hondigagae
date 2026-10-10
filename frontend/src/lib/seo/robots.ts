import type { MetadataRoute } from 'next'

import { absoluteUrl, isProductionSite } from '@/lib/seo/site'

/**
 * `robots.txt` 규칙 (#1130).
 *
 * **운영이 아니면 전부 막는다.** dev 의 noindex 는 nginx 헤더라 저장소 밖에 있다
 * (`lib/seo/site.ts` 머리주석). 운영과 같은 글이 dev 도메인으로 색인되면 순위가 나뉜다.
 *
 * **막는 것은 크롤러가 볼 이유가 없는 경로뿐이다.**
 *  - `/api/` — BFF 프록시. 화면이 아니다
 *  - 보호 경로(`proxy.ts` `PROTECTED_PATHS`) — 로그인으로 307 이라 크롤러에겐 로그인 화면이다.
 *    **목록을 베끼지 않고 같은 상수를 받는다** — 화면이 늘 때 한쪽만 고치면 어긋난다
 *  - `/oauth/` — 소셜 제공자가 돌려보내는 착지점
 *
 * **로그인·가입·공유 일정은 막지 않는다.** 막으면 크롤러가 페이지를 읽지 못해 그 안의
 * `noindex` 도 보지 못하고, 외부 링크만으로 주소가 검색 결과에 남을 수 있다. 그 화면들은
 * 메타 `robots` 로 색인을 끈다.
 */
export function buildRobots(base: string, protectedPaths: readonly string[]): MetadataRoute.Robots {
  if (!isProductionSite(base)) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/oauth/', ...protectedPaths],
    },
    sitemap: absoluteUrl('/sitemap.xml', base),
  }
}
