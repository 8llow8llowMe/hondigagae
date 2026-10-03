import { describe, expect, it } from 'vitest'

import { listThumbnailSrc } from '@/lib/image/thumbnail'

/*
  TourAPI 의 두 크기 (2026-10-03 실측, `docs/seo-review-2026-10-03.md` §3):
  - `firstImage`  — `…_image2_1.jpg` · 940×627 · 장당 500~780KB
  - `firstImage2` — `…_image3_1.jpg` · 150×100 · ~20KB
*/
const LARGE = 'http://tong.visitkorea.or.kr/cms/resource/60/2666460_image2_1.jpg'
const SMALL = 'http://tong.visitkorea.or.kr/cms/resource/60/2666460_image3_1.jpg'

describe('listThumbnailSrc — 목록 썸네일은 작은 사진이 먼저다 (#1132)', () => {
  it('작은 사진이 있으면 그것을 쓴다', () => {
    expect(listThumbnailSrc(SMALL, LARGE)).toBe(
      'https://tong.visitkorea.or.kr/cms/resource/60/2666460_image3_1.jpg',
    )
  })

  it('작은 사진이 없으면 큰 사진으로 떨어진다', () => {
    expect(listThumbnailSrc(null, LARGE)).toBe(
      'https://tong.visitkorea.or.kr/cms/resource/60/2666460_image2_1.jpg',
    )
  })

  /*
    `small ?? large` 로 고르고 나서 판정하면, 작은 사진이 **있지만 못 쓰는** 경우(허용 목록
    밖 호스트·빈 문자열)에 쓸 수 있는 큰 사진을 두고 "사진 없음" 이 된다.
  */
  it('작은 사진을 못 쓰면(허용 목록 밖 · 빈 문자열) 큰 사진으로 떨어진다', () => {
    expect(listThumbnailSrc('http://cdn.not-allowed.invalid/a.jpg', LARGE)).toBe(
      'https://tong.visitkorea.or.kr/cms/resource/60/2666460_image2_1.jpg',
    )
    expect(listThumbnailSrc('  ', LARGE)).toBe(
      'https://tong.visitkorea.or.kr/cms/resource/60/2666460_image2_1.jpg',
    )
  })

  it('둘 다 못 쓰면 null 이다 — 호출부가 일러스트로 자리를 채운다', () => {
    expect(listThumbnailSrc(null, null)).toBeNull()
    expect(listThumbnailSrc(null, 'http://cdn.not-allowed.invalid/b.jpg')).toBeNull()
  })
})
