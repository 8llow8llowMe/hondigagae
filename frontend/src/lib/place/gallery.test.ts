import { describe, expect, it } from 'vitest'

import { galleryImages } from '@/lib/place/gallery'
import type { PlaceImage } from '@/types/place'

function image(overrides: Partial<PlaceImage> = {}): PlaceImage {
  return {
    originImgUrl: 'http://tong.visitkorea.or.kr/cms/resource/1/a.jpg',
    smallImageUrl: null,
    imgName: null,
    cpyrhtDivCd: 'Type1',
    ...overrides,
  }
}

describe('galleryImages — images 가 비면 대표 이미지를 쓴다', () => {
  /*
    **dev 실측이 이 함수를 만들게 했다.** `images` 는 모든 장소에서 빈 배열이고
    사진은 `firstImage` 로만 온다 — `firstImage` 가 있는 장소 12건을 상세로 전수
    조회했는데 `images[]` 가 채워진 것은 0건이었다. 상세가 `images` 만 보면
    사진 있는 장소(제주 표본의 30%)가 한 장도 못 보인다.
  */
  it('images 가 비면 firstImage 한 장을 만든다', () => {
    const result = galleryImages([], 'http://tong.visitkorea.or.kr/cms/resource/90/a.jpg', 'Type1')

    expect(result).toEqual([
      {
        originImgUrl: 'http://tong.visitkorea.or.kr/cms/resource/90/a.jpg',
        smallImageUrl: null,
        imgName: null,
        cpyrhtDivCd: 'Type1',
      },
    ])
  })

  it('images 가 있으면 그것을 쓰고 firstImage 를 섞지 않는다', () => {
    const images = [image(), image({ originImgUrl: 'http://tong.visitkorea.or.kr/cms/2/b.jpg' })]

    expect(
      galleryImages(images, 'http://tong.visitkorea.or.kr/cms/resource/90/a.jpg', 'Type1'),
    ).toEqual(images)
  })

  /** 둘 다 없으면 빈 배열이다 — 갤러리는 0장이면 섹션을 렌더하지 않는다 (DESIGN.md §7-3) */
  it('둘 다 없으면 빈 배열이다', () => {
    expect(galleryImages([], null, null)).toEqual([])
    expect(galleryImages([], '', null)).toEqual([])
  })

  /**
   * 호스트 판정은 하지 않는다 — `PhotoGallery` 가 `imageSrc` 로 한 번만 한다.
   * 두 곳에서 걸러 내면 한쪽 규칙이 바뀔 때 조용히 어긋난다.
   */
  it('미등록 호스트도 그대로 넘긴다 — 판정은 갤러리가 한다', () => {
    expect(galleryImages([], 'https://cdn.example.com/1.jpg', null)).toHaveLength(1)
  })
})
