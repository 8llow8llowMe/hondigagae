import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ViewToggle } from '@/components/view-toggle'
import { messages } from '@/lib/messages'

function render(overrides: Partial<Parameters<typeof ViewToggle>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(ViewToggle, {
      current: 'map' as const,
      listHref: '/places?view=list',
      mapHref: '/places?view=map',
      ...overrides,
    }),
  )
}

describe('ViewToggle — 아이콘형이 기본이고 이름을 두 곳에 남긴다 (#240)', () => {
  /*
    지도 위에 글자 버튼 두 개가 얹히면 지도를 가리고 컨트롤로 보이지 않았다.
    아이콘만 남기는 대신 **이름을 잃지 않는다** — `aria-label`(보조기기)과
    `title`(마우스 호버 툴팁) 양쪽에 남긴다.
  */
  it('기본이 아이콘형이다 — 호출부가 잊어도 세 화면이 갈리지 않는다', () => {
    const markup = render()

    expect(markup).toContain('<svg')
    expect(markup).not.toContain(`>${messages.map.listView}<`)
  })

  it('호버 툴팁과 보조기기 이름을 함께 준다', () => {
    const markup = render()

    expect(markup).toContain(`title="${messages.map.listView}"`)
    expect(markup).toContain(`title="${messages.map.mapView}"`)
    expect(markup).toContain(`aria-label="${messages.map.showList}"`)
    expect(markup).toContain(`aria-label="${messages.map.showMap}"`)
  })

  it('현재 보기를 보조기기에도 남긴다', () => {
    expect(render({ current: 'map' })).toContain('aria-current="true"')
  })

  /** 글자형은 남겨 둔다 — 지도 위가 아닌 자리에서 쓸 수 있다 */
  it('글자형을 주면 라벨을 글자로 낸다', () => {
    const markup = render({ variant: 'text' })

    expect(markup).toContain(messages.map.listView)
    expect(markup).not.toContain('title=')
  })
})
