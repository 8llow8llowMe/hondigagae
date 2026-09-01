import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ViewToggle } from '@/components/view-toggle'
import { messages } from '@/lib/messages'

function render(overrides: Partial<Parameters<typeof ViewToggle>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(ViewToggle, {
      current: 'list' as const,
      listHref: '/places',
      mapHref: '/places?view=map',
      ...overrides,
    }),
  )
}

describe('ViewToggle', () => {
  it('두 보기 모두 링크다 — JS 없이도 전환된다', () => {
    const markup = render()

    expect(markup).toContain('href="/places"')
    expect(markup).toContain('href="/places?view=map"')
  })

  it('현재 보기를 보조기기에 알린다', () => {
    const markup = render({ current: 'map' })

    // 지도 쪽에만 붙는다 — 하나뿐이고, 그것이 지도 링크와 같은 태그 안에 있다
    expect(markup.match(/aria-current="true"/g)).toHaveLength(1)

    const mapAnchor = /<a[^>]*href="\/places\?view=map"[^>]*>/.exec(markup)?.[0] ?? ''
    expect(mapAnchor).toContain('aria-current="true"')
  })

  it('글자형은 라벨을 그대로 쓴다', () => {
    const markup = render()

    expect(markup).toContain(messages.map.listView)
    expect(markup).toContain(messages.map.mapView)
  })

  it('아이콘형은 이름을 aria-label 로 남긴다 — 라벨이 들어갈 자리가 없다', () => {
    const markup = render({ variant: 'icon' })

    expect(markup).toContain(`aria-label="${messages.map.showMap}"`)
    expect(markup).toContain(`aria-label="${messages.map.showList}"`)
  })

  it('그룹에 이름을 준다 — 버튼 두 개가 맥락 없이 읽히지 않게 한다', () => {
    expect(render()).toContain(`aria-label="${messages.map.viewToggleLabel}"`)
  })
})
