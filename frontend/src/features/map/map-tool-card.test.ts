import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MapToolCard } from '@/features/map/map-tool-card'

/**
 * 지도 우측 아이콘 묶음 카드 — #1300 (`docs/features/place/지도-아일랜드알약-정리-세부명세.md` D1-2 · D3-3 · D7-4).
 *
 * 칸 사이에만 전폭 구분선이 서고, 빈 자식(`false` · `null`)은 칸으로 세지 않는다 — `내 위치` 는 위치 판정 뒤에야
 * 붙고(`locatable`), 담기 지도는 층 칸이 없다.
 */
const cell = (label: string) => createElement('button', { type: 'button' }, label)

function render(...children: (ReturnType<typeof cell> | false | null)[]) {
  return renderToStaticMarkup(createElement(MapToolCard, null, ...children))
}

function cardClasses(markup: string): string[] {
  return /^<div class="([^"]*)"/.exec(markup)?.[1]?.split(/\s+/) ?? []
}

const dividers = (markup: string) => markup.match(/data-map-tool-divider/g)?.length ?? 0

describe('MapToolCard', () => {
  it('칸 둘이면 사이에 구분선 하나다', () => {
    const markup = render(cell('병원·약국'), cell('내 위치'))

    expect(dividers(markup)).toBe(1)
    expect(markup.indexOf('병원·약국')).toBeLessThan(markup.indexOf('data-map-tool-divider'))
    expect(markup.indexOf('data-map-tool-divider')).toBeLessThan(markup.indexOf('내 위치'))
  })

  it('칸 하나면 구분선이 없다 — 빈 자식은 칸이 아니다', () => {
    expect(dividers(render(cell('병원·약국'), false))).toBe(0)
    expect(dividers(render(null, cell('내 위치')))).toBe(0)
  })

  it('칸이 없으면 카드도 없다', () => {
    expect(render(false, null)).toBe('')
  })

  /* 떠 있는 조작 = 둥근 사각 (D1-1 모양 언어). 켠 칸의 채움이 카드 곡률에서 잘린다 */
  it('카드는 폭 48 · 테두리 · rounded-lg · shadow-md · overflow-hidden · 지도 드래그 위에서 눌린다', () => {
    const classes = cardClasses(render(cell('병원·약국')))

    expect(classes).toEqual(
      expect.arrayContaining([
        'w-12',
        'rounded-lg',
        'border',
        'border-border',
        'bg-bg',
        'shadow-md',
        'overflow-hidden',
        'flex-col',
        'pointer-events-auto',
      ]),
    )
    expect(classes).not.toContain('rounded-full')
  })

  it('구분선은 전폭 1px 장식이다 — 보조기기가 읽지 않는다', () => {
    const divider = /<div [^>]*data-map-tool-divider[^>]*>/.exec(
      render(cell('병원·약국'), cell('내 위치')),
    )?.[0]

    expect(divider).toContain('aria-hidden="true"')
    expect(divider).toMatch(/class="bg-border h-px"/)
  })
})
