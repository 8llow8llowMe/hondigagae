import type { Metadata } from 'next'

import { SITE_NAME } from '@/lib/seo/site'

/**
 * 공개 화면의 메타데이터 한 벌 (#1130).
 *
 * **`openGraph` 를 화면마다 통째로 낸다.** Next 는 메타데이터를 키 단위로 얕게 합친다 —
 * 자식이 `openGraph` 를 내지 않으면 루트의 것이 그대로 상속돼, 예전에는 모든 화면의
 * `og:title` 이 `혼디가개`, `og:url` 이 홈이었다. 카카오톡·페이스북은 `og:url` 을 정규 주소로
 * 보고 공유를 그 주소로 모으므로 **어떤 장소를 공유해도 홈 카드가 떴다.** 자식이 `openGraph`
 * 를 내면 루트의 것을 덮으므로 `type`·`locale`·`siteName` 도 여기서 다시 적는다.
 *
 * **`canonical` 은 경로만 준다.** 루트 `metadataBase` 가 도메인을 붙인다. 쿼리(필터·되돌림용
 * `returnTo` 등)가 붙은 주소가 같은 화면의 다른 URL 로 색인되는 것을 막는다 (#783 과 같은 이유).
 *
 * **이미지가 없으면 브랜드 카드를 직접 적는다.** `app/opengraph-image.png` 파일 규약은 화면이
 * `openGraph` 를 내는 순간 그 화면에서 빠진다 — 렌더된 `<head>` 에 `og:image` 가 아예 없었다
 * (dev 서버 실측). 그래서 같은 파일의 라우트(`/opengraph-image.png`)를 여기서 가리킨다.
 */
export type PageMetadataInput = {
  /** `<title>` 전체 (접미사 `· 혼디가개` 포함) */
  title: string
  description: string
  /** `/places/123` 처럼 쿼리 없는 경로 */
  path: string
  /** 공유 카드에 쓸 이미지 (절대 URL). 장소·코스 대표 사진 등. 없으면 브랜드 카드 */
  image?: string | null
}

/** `app/opengraph-image.png` 의 라우트와 실제 크기 (아트보드 `혼디가개 브랜드 자산` 4절) */
export const BRAND_SHARE_IMAGE = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  type: 'image/png',
} as const

export function pageMetadata({ title, description, path, image }: PageMetadataInput): Metadata {
  const images = image ? [{ url: toHttps(image) }] : [BRAND_SHARE_IMAGE]

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  }
}

/**
 * 색인하지 않되 링크는 따라가게 한다.
 *
 * `nofollow` 를 쓰지 않는 이유: 이 화면들(로그인, 동반 정보가 없는 장소)에서 나가는 링크는
 * 대부분 색인할 공개 화면이다. 막으면 크롤러가 그 길로 들어간 공개 화면을 놓친다.
 */
export const NOINDEX_FOLLOW: NonNullable<Metadata['robots']> = { index: false, follow: true }

/**
 * TourAPI 는 사진 주소를 `http://` 로 주는 곳이 섞여 있다(`tong.visitkorea.or.kr` 는 https 도
 * 받는다). 공유 크롤러 일부가 https 페이지의 http 이미지를 버린다.
 */
function toHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
}
