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

function render(count: number, contentTypeCode: string | null = null) {
  const images = Array.from({ length: count }, (_, index) => image(index + 1))

  return renderToStaticMarkup(
    createElement(PhotoGallery, {
      images,
      title: '제주특별자치도립김창열미술관',
      contentTypeCode,
    }),
  )
}

describe('PhotoGallery — 장수별 배치 (가이드 §5)', () => {
  it('0장이고 카테고리를 모르면 섹션 자체를 렌더하지 않는다', () => {
    expect(render(0)).toBe('')
  })

  it('1장이면 전폭으로 늘리지 않고 660px 에서 멈춘다', () => {
    const markup = render(1)

    expect(markup).toContain('--gallery-w-single-max')
    // 열이 하나뿐이다 — 비율 분할이 아니다
    expect(markup).not.toContain('1.62fr')
  })

  it('2장이면 균등 2분할이고 썸네일 열을 만들지 않는다', () => {
    const markup = render(2)

    expect(markup).toContain('grid-template-columns:1fr 1fr')
    expect(markup).not.toContain('1.62fr')
  })

  it('3장 이상이면 대표 + 썸네일 2 로 나눈다', () => {
    const markup = render(3)

    // 고정 px 가 아니라 비율이다 — 데스크톱 2단의 우측 열이 가변이기 때문이다
    expect(markup).toContain('grid-template-columns:1.62fr 1fr')
    expect(markup).toContain('grid-template-rows:1fr 1fr')
  })

  it('데스크톱 대표·썸네일 폭을 고정 px 토큰으로 두지 않는다', () => {
    const markup = render(3)

    expect(markup).not.toContain('--gallery-w-lead')
    expect(markup).not.toContain('--gallery-w-thumb')
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

describe('PhotoGallery — 사진이 없을 때 (DESIGN.md §7-3)', () => {
  it('카테고리 일러스트로 자리를 채운다', () => {
    const markup = render(0, 'CULTURE')

    expect(markup).toContain('/illustrations/place-culture.svg')
    // 고정 높이는 사진이 있을 때와 같다 — 자리의 크기가 흔들리면 안 된다
    expect(markup).toContain('--gallery-h-mobile')
    expect(markup).toContain('--gallery-h-desktop')
  })

  it('일러스트에는 사진 출처를 붙이지 않는다', () => {
    // 한국관광공사가 준 사진이 아니라 우리가 그린 도형이다
    expect(render(0, 'CULTURE')).not.toContain(messages.place.photoSource)
  })

  it('일러스트는 장식이라 뷰어를 열지 않는다', () => {
    // 확대해 봐야 같은 도형이고, 누를 수 있으면 "사진이 더 있다" 로 읽힌다
    expect(render(0, 'CULTURE')).not.toContain('<button')
  })

  it('자산이 없는 카테고리는 회색 타일로 떨어뜨리지 않고 렌더하지 않는다', () => {
    // 없애려던 회색 벽이 그대로 돌아온다
    expect(render(0, 'SHOPPING')).toBe('')
  })

  it('사진이 한 장이라도 있으면 일러스트를 쓰지 않는다', () => {
    expect(render(1, 'CULTURE')).not.toContain('/illustrations/')
  })
})

describe('PhotoGallery — 뷰어 열기 (+N 뒤의 사진)', () => {
  it('모든 타일이 뷰어를 여는 버튼이다', () => {
    const markup = render(3)

    expect(markup).toContain('<button')
    expect(markup).toContain(messages.place.galleryOpenAction.replace('{index}', '1'))
  })

  it('+N 은 장수만 말하지 않고 나머지를 여는 버튼이다', () => {
    // 8장 = 대표 1 + 썸네일 2 + 나머지 5. 그 5장은 뷰어 말고는 도달할 경로가 없다
    const markup = render(8)

    expect(markup).toContain('+5')
    expect(markup).toContain(messages.place.galleryOpenMoreAction.replace('{count}', '5'))
  })

  it('뷰어는 닫힌 채로 렌더된다 — 사진을 누르기 전에는 열리지 않는다', () => {
    // 문구로 보지 않는다 — 타일 라벨(`1번째 사진 크게 보기`)이 뷰어 제목을 부분 문자열로
    // 품고 있어 항상 잡힌다. 다이얼로그가 실제로 있는지를 본다
    expect(render(8)).not.toContain('role="dialog"')
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
