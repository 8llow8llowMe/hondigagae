import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as code } from '@/test/source'

/**
 * **공개 화면은 제 정규 주소와 공유 카드를 낸다** — 이슈 #1130.
 *
 * 메타데이터는 `export const metadata` / async `generateMetadata` 라 렌더해 볼 수 없다
 * (`testing-guide.md` §1). 값 자체는 `lib/seo/*.test.ts` 가 잠그고, 여기서는 **배선**을 본다 —
 * 화면이 `pageMetadata()` 를 거치고 제 경로를 넘기는가.
 *
 * 하나라도 빠지면 그 화면은 루트 `openGraph` 를 상속한다. 예전에는 그 상속이 `og:url` = 홈이라
 * 공유가 전부 홈으로 모였다.
 */
const PUBLIC_PAGES = [
  ['app/(main)/(home)/page.tsx', "path: '/'"],
  ['app/(main)/places/(list)/page.tsx', "path: '/places'"],
  ['app/(main)/places/[placeId]/page.tsx', 'path: `/places/${placeId}`'],
  ['app/(main)/olle/(list)/page.tsx', "path: '/olle'"],
  ['app/(main)/olle/[walkCourseId]/page.tsx', 'path: `/olle/${walkCourseId}`'],
  ['app/(main)/emergency/page.tsx', "path: '/emergency'"],
  ['app/(main)/about/page.tsx', "path: '/about'"],
  ['app/(main)/terms/page.tsx', "path: '/terms'"],
  ['app/(main)/privacy/page.tsx', "path: '/privacy'"],
] as const

describe('공개 화면 메타데이터 배선 (#1130)', () => {
  it.each(PUBLIC_PAGES)('%s — pageMetadata 로 제 경로를 낸다', (path, probe) => {
    const source = code(path)

    expect(source).toContain('pageMetadata(')
    expect(source).toContain(probe)
  })

  it('루트 openGraph 에 url 이 없다 — 있으면 모든 화면이 홈 주소를 상속한다', () => {
    const source = code('app/layout.tsx')
    const openGraph = source.slice(source.indexOf('openGraph: {'), source.indexOf('twitter:'))

    expect(openGraph).toContain("siteName: '혼디가개'")
    expect(openGraph).not.toMatch(/\burl:/)
  })

  it('인증 그룹은 색인하지 않는다 — 레이아웃 하나로 네 화면이 상속한다', () => {
    expect(code('app/(auth)/layout.tsx')).toContain(
      'export const metadata: Metadata = { robots: NOINDEX_FOLLOW }',
    )
  })

  it('장소 상세는 사이트맵과 같은 판정으로 noindex 를 건다', () => {
    const source = code('app/(main)/places/[placeId]/page.tsx')

    expect(source).toContain('isIndexablePlace(place) ? {} : { robots: NOINDEX_FOLLOW }')
  })

  it.each([
    ['app/(main)/(home)/page.tsx', '<JsonLd data={siteJsonLd(siteUrl())} />'],
    ['app/(main)/places/[placeId]/page.tsx', 'placeJsonLd(place, siteUrl())'],
    ['app/(main)/olle/[walkCourseId]/page.tsx', 'walkCourseJsonLd(course, siteUrl())'],
  ])('%s — 구조화 데이터를 낸다 (#1131)', (path, probe) => {
    expect(code(path)).toContain(probe)
  })

  it('검색어 랜딩도 pageMetadata 와 JSON-LD 를 낸다 (#1134)', () => {
    const source = code('app/(main)/jeju/[topic]/page.tsx')

    expect(source).toContain('pageMetadata(')
    expect(source).toContain('path: landingPath(topic, after)')
    expect(source).toContain('itemListJsonLd(')
    expect(source).toContain('notFound()')
  })
})
