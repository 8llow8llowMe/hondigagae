import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PhotoViewer, type ViewerImage } from '@/features/place/photo-viewer'
import { messages } from '@/lib/messages'

const TITLE = '제주특별자치도립김창열미술관'

function images(count: number): ViewerImage[] {
  return Array.from({ length: count }, (_, index) => ({
    src: `https://tong.visitkorea.or.kr/cms/resource/mock/place-${index + 1}.jpg`,
    imgName: `사진 ${index + 1}`,
  }))
}

function render(index: number | null, count = 8) {
  return renderToStaticMarkup(
    createElement(PhotoViewer, {
      images: images(count),
      index,
      onIndexChange: () => undefined,
      onClose: () => undefined,
      title: TITLE,
    }),
  )
}

describe('PhotoViewer — 열림 여부', () => {
  it('index 가 null 이면 아무것도 렌더하지 않는다', () => {
    expect(render(null)).toBe('')
  })

  it('열리면 다이얼로그 계약을 갖춘다', () => {
    const markup = render(0)

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    // 이름은 sr-only 제목이 준다 — 화면에는 장소명과 카운터가 보인다
    expect(markup).toContain(messages.place.galleryViewerTitle)
    expect(markup).toContain('aria-labelledby')
  })

  it('범위 밖 index 에는 던지지 않고 아무것도 렌더하지 않는다', () => {
    expect(render(99, 3)).toBe('')
  })
})

describe('PhotoViewer — 확대해 보는 화면이다', () => {
  it('가장자리를 잘라내지 않는다 (contain)', () => {
    const markup = render(0)

    // 갤러리 타일은 cover(고정 높이를 지킨다)지만 여기는 반대다
    expect(markup).toContain('object-contain')
    expect(markup).not.toContain('object-cover')
  })

  it('첫 사진의 alt 는 장소명이다 — 장식이 아니라 콘텐츠다', () => {
    expect(render(0)).toContain(`alt="${TITLE}"`)
  })

  it('나머지 사진은 원천이 준 이름을 alt 로 쓴다', () => {
    expect(render(2)).toContain('alt="사진 3"')
  })
})

describe('PhotoViewer — 좌우 이동', () => {
  it('위치를 카운터로 말한다', () => {
    const markup = render(2, 8)

    expect(markup).toContain(
      messages.place.galleryPosition.replace('{index}', '3').replace('{total}', '8'),
    )
  })

  it('순환하지 않는다 — 첫 장에서 이전이 잠긴다', () => {
    const markup = render(0, 8)

    expect(markup).toContain(messages.place.galleryPrevAction)
    // 끝에서 처음으로 돌면 카운터가 뒤로 뛰어 몇 장 남았는지 읽을 수 없다
    expect(markup).toContain('disabled')
  })

  it('1장이면 좌우 버튼도 카운터도 그리지 않는다', () => {
    const markup = render(0, 1)

    expect(markup).not.toContain(messages.place.galleryPrevAction)
    expect(markup).not.toContain(messages.place.galleryNextAction)
    expect(markup).not.toContain(
      messages.place.galleryPosition.replace('{index}', '1').replace('{total}', '1'),
    )
  })

  it('닫기 버튼이 있다', () => {
    expect(render(0)).toContain(messages.common.close)
  })
})
