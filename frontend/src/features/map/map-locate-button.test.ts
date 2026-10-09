import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MapLocateButton } from '@/features/map/map-locate-button'
import { messages } from '@/lib/messages'

/**
 * 내 위치 버튼의 두 모양 — #1300 (`지도-아일랜드알약-정리-세부명세.md` D1-2 · D7-4).
 *
 * **기본(`floating`)은 #1300 전 마크업 그대로다** — `/emergency` · 일정 담기 지도가 계속 쓴다. `cell` 은 지도 도구
 * 카드의 칸이라 테두리 · 그림자 · 곡률을 카드에 맡긴다.
 */
const noop = () => undefined

function buttonTag(variant?: 'floating' | 'cell') {
  const markup = renderToStaticMarkup(
    createElement(MapLocateButton, {
      onLocate: noop,
      ...(variant === undefined ? {} : { variant }),
    }),
  )
  return /<button[^>]*>/.exec(markup)?.[0] ?? ''
}

function classes(tag: string): string[] {
  return /class="([^"]*)"/.exec(tag)?.[1]?.split(/\s+/) ?? []
}

describe('MapLocateButton', () => {
  it('기본 갈래는 예전 여는 태그 그대로다', () => {
    expect(buttonTag()).toBe(
      `<button type="button" aria-label="${messages.map.myLocation}" title="${messages.map.myLocation}" class="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 flex size-11 items-center justify-center rounded-lg border shadow-md focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none">`,
    )
  })

  it('cell 갈래는 테두리 · 그림자 · 곡률이 없는 46 × 48 칸이다 — 이름은 그대로', () => {
    const tag = buttonTag('cell')
    const names = classes(tag)

    expect(tag).toContain(`aria-label="${messages.map.myLocation}"`)
    expect(names).toEqual(expect.arrayContaining(['h-12', 'w-full', 'focus-visible:ring-inset']))
    for (const name of ['border', 'border-border', 'shadow-md', 'rounded-lg', 'bg-bg', 'size-11'])
      expect(names).not.toContain(name)
  })
})
