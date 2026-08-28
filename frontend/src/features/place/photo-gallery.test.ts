import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PhotoGallery } from '@/features/place/photo-gallery'
import { messages } from '@/lib/messages'
import type { PlaceImage } from '@/types/place'

/** 허용 호스트여야 next/image 에 넘어간다 — 아니면 걸러진다 */
function image(index: number): PlaceImage {
  return {
    originImgUrl: `http://tong.visitkorea.or.kr/cms/resource/mock/place-${index}.jpg`,
    smallImageUrl: null,
    imgName: `사진 ${index}`,
    cpyrhtDivCd: 'Type1',
  }
}

function render(count: number) {
  const images = Array.from({ length: count }, (_, index) => image(index + 1))

  return renderToStaticMarkup(
    createElement(PhotoGallery, { images, title: '제주특별자치도립김창열미술관' }),
  )
}

describe('PhotoGallery — 장수별 배치 (가이드 §5)', () => {
  it('0장이면 섹션 자체를 렌더하지 않는다', () => {
    expect(render(0)).toBe('')
  })

  it('1장이면 전폭으로 늘리지 않고 660px 에서 멈춘다', () => {
    const markup = render(1)

    expect(markup).toContain('--gallery-w-single-max')
    expect(markup).not.toContain('--gallery-w-lead')
    expect(markup).not.toContain('--gallery-w-thumb')
  })

  it('2장이면 균등 2분할이고 썸네일 열을 만들지 않는다', () => {
    const markup = render(2)

    expect(markup).toContain('calc((100% - 8px) / 2)')
    expect(markup).not.toContain('--gallery-w-thumb')
  })

  it('3장 이상이면 대표 + 썸네일 2 로 나눈다', () => {
    const markup = render(3)

    expect(markup).toContain('--gallery-w-lead')
    expect(markup).toContain('--gallery-w-thumb')
  })

  it('썸네일에 담기지 않는 나머지는 +N 으로 얹는다', () => {
    // 8장 = 대표 1 + 썸네일 2 + 나머지 5
    expect(render(8)).toContain('+5')
  })

  it('나머지가 없으면 +N 을 그리지 않는다', () => {
    expect(render(3)).not.toContain('+0')
  })
})

describe('PhotoGallery — 높이는 항상 고정', () => {
  it('장수와 무관하게 고정 높이 토큰을 쓴다', () => {
    for (const count of [1, 2, 3, 8]) {
      const markup = render(count)

      expect(markup).toContain('--gallery-h-mobile')
      expect(markup).toContain('--gallery-h-desktop')
      // aspect-* 로 높이를 콘텐츠에 맡기지 않는다 — TourAPI 해상도가 고르지 않다
      expect(markup).not.toContain('aspect-')
    }
  })
})

describe('PhotoGallery — 모바일 캐러셀', () => {
  it('scroll-snap 으로 넘길 수 있음을 알린다', () => {
    const markup = render(3)

    expect(markup).toContain('snap-x')
    expect(markup).toContain('snap-start')
  })

  it('점 인디케이터가 아니라 카운터를 쓴다', () => {
    const markup = render(8)

    expect(markup).toContain('1/8')
  })

  it('1장이면 카운터를 그리지 않는다', () => {
    expect(render(1)).not.toContain('1/1')
  })
})

describe('PhotoGallery — 출처', () => {
  it('사진 출처를 갤러리 바로 아래에 붙인다', () => {
    expect(render(1)).toContain(messages.place.photoSource)
  })

  it('본문 끝의 정보 출처와 문구가 갈린다', () => {
    expect(messages.place.photoSource).not.toBe(messages.place.detailCopyrightPrefix)
  })
})

describe('PhotoGallery — 미등록 호스트', () => {
  it('next/image 가 던지지 않도록 허용 호스트가 아닌 것은 걸러낸다', () => {
    const markup = renderToStaticMarkup(
      createElement(PhotoGallery, {
        images: [{ ...image(1), originImgUrl: 'https://evil.example.com/a.jpg' }],
        title: '테스트',
      }),
    )

    expect(markup).toBe('')
  })
})
