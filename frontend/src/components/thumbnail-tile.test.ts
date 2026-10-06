import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ThumbnailTile, type ThumbnailTileProps } from '@/components/thumbnail-tile'

const PHOTO = 'https://tong.visitkorea.or.kr/cms/resource/60/2666460_image3_1.jpg'
const ILLUSTRATION = '/illustrations/place-lodging.webp'

function render(props: Partial<ThumbnailTileProps> = {}) {
  return renderToStaticMarkup(createElement(ThumbnailTile, { src: null, ...props }))
}

/** 타일 바깥 div 의 class 만 뽑는다 — 안쪽 칩·폴백의 class 와 섞이지 않게 한다 */
function tileClass(html: string) {
  return /^<div class="([^"]*)"/.exec(html)?.[1] ?? ''
}

describe('ThumbnailTile — 폴백 순서 (#1151)', () => {
  it('사진이 있으면 사진이 이긴다', () => {
    const html = render({ src: PHOTO, illustration: ILLUSTRATION })

    expect(html).toContain(encodeURIComponent(PHOTO))
    expect(html).not.toContain(ILLUSTRATION)
  })

  it('사진이 없으면 일러스트를 장식으로 그린다', () => {
    expect(render({ illustration: ILLUSTRATION })).toMatch(
      /<img[^>]*src="\/illustrations\/place-lodging\.webp"[^>]*alt=""/,
    )
  })

  it('둘 다 없으면 회색 타일 아이콘이다', () => {
    const html = render()

    expect(html).not.toContain('<img')
    expect(html).toContain('<svg')
  })

  it('회색 타일 낱말은 주었을 때만 붙는다', () => {
    expect(render({ emptyLabel: '사진 없음' })).toContain('사진 없음')
    expect(render()).not.toContain('사진 없음')
  })

  it('사진은 장식이다 — 이름은 행의 제목이 말한다', () => {
    expect(render({ src: PHOTO })).toMatch(/<img[^>]*alt=""/)
  })
})

describe('ThumbnailTile — 크기 기준', () => {
  it('기본은 뷰포트 기준이다 (일정 · 즐겨찾기 행)', () => {
    const cls = tileClass(render())

    expect(cls).toContain('size-20')
    expect(cls).toMatch(/(^| )lg:size-24( |$)/)
  })

  /* 장소 목록은 지도 패널처럼 좁은 칸에도 들어가 컨테이너 기준이다 */
  it('컨테이너 기준이면 @lg 다', () => {
    const cls = tileClass(render({ sizeBasis: 'container' }))

    expect(cls).toContain('@lg:size-24')
    expect(cls).not.toMatch(/(^| )lg:size-24/)
  })
})

describe('ThumbnailTile — 순번 칩 (#856)', () => {
  function chip(html: string) {
    return /<span aria-hidden="true" class="([^"]*)">3<\/span>/.exec(html)?.[1] ?? ''
  }

  it('순번을 주면 좌상단 흰 원형 칩이다', () => {
    const cls = chip(render({ ordinal: 3 }))

    expect(cls).toContain('absolute')
    expect(cls).toContain('bg-bg')
    expect(cls).toContain('rounded-full')
    expect(cls).toContain('border-border-strong')
    expect(cls).not.toContain('shadow')
  })

  it('순번을 주지 않으면 칩이 없다', () => {
    expect(chip(render())).toBe('')
  })
})

describe('ThumbnailTile — 흐림 · 로딩', () => {
  it('흐림은 타일 전체에 건다 — 칩까지 함께 물러난다', () => {
    expect(tileClass(render({ dimmed: true }))).toContain('opacity-60')
    expect(tileClass(render())).not.toContain('opacity-60')
  })

  it('우선 로드면 사진을 바로 받는다', () => {
    const html = render({ src: PHOTO, priority: true })

    expect(html).not.toContain('loading="lazy"')
    expect(html).toMatch(/fetchPriority="high"|fetchpriority="high"/)
  })

  it('기본은 지연 로드다', () => {
    expect(render({ src: PHOTO })).toContain('loading="lazy"')
  })
})
