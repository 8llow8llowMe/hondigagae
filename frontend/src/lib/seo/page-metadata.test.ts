import { describe, expect, it } from 'vitest'

import { BRAND_SHARE_IMAGE, pageMetadata } from '@/lib/seo/page-metadata'

describe('pageMetadata — 화면마다 제 공유 카드를 낸다 (#1130)', () => {
  const base = {
    title: '수월봉 반려견 동반 가능 · 혼디가개',
    description: '설명',
    path: '/places/1',
  }

  it('canonical 과 og:url 이 이 화면의 경로다 — 홈이 아니다', () => {
    const metadata = pageMetadata(base)

    expect(metadata.alternates?.canonical).toBe('/places/1')
    expect(metadata.openGraph?.url).toBe('/places/1')
  })

  it('og·twitter 제목과 설명이 화면 값이다', () => {
    const metadata = pageMetadata(base)

    expect(metadata.openGraph?.title).toBe(base.title)
    expect(metadata.openGraph?.description).toBe(base.description)
    expect(metadata.twitter?.title).toBe(base.title)
  })

  /*
    자식이 openGraph 를 내면 루트의 것을 통째로 덮는다 — siteName·locale 을 다시 적지 않으면
    공유 카드에서 사라진다.
  */
  it('루트에서 덮이는 siteName · locale 을 다시 적는다', () => {
    expect(pageMetadata(base).openGraph).toMatchObject({ siteName: '혼디가개', locale: 'ko_KR' })
  })

  /*
    화면이 openGraph 를 내면 app/opengraph-image.png 파일 규약이 그 화면에서 빠진다 —
    dev 서버에서 og:image 가 아예 없는 것을 확인했다.
  */
  it('이미지가 없으면 브랜드 카드를 직접 싣는다', () => {
    const metadata = pageMetadata({ ...base, image: null })

    expect(metadata.openGraph?.images).toEqual([BRAND_SHARE_IMAGE])
    expect(metadata.twitter?.images).toEqual([BRAND_SHARE_IMAGE])
  })

  it('http 사진 주소를 https 로 바꿔 싣는다', () => {
    const metadata = pageMetadata({
      ...base,
      image: 'http://tong.visitkorea.or.kr/cms/resource/1/1_image2_1.jpg',
    })

    expect(metadata.openGraph?.images).toEqual([
      { url: 'https://tong.visitkorea.or.kr/cms/resource/1/1_image2_1.jpg' },
    ])
  })
})
