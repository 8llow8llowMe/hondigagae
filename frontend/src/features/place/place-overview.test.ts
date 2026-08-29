import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceOverview } from '@/features/place/place-overview'
import { messages } from '@/lib/messages'

const SHORT = '제주 자연을 그대로 살린 공간이다.'
const LONG = SHORT.repeat(12)

function render(text: string) {
  return renderToStaticMarkup(createElement(PlaceOverview, { text }))
}

describe('PlaceOverview — 접기는 접을 것이 있을 때만이다', () => {
  it('짧은 소개는 접지 않고 버튼도 만들지 않는다', () => {
    const markup = render(SHORT)

    expect(markup).toContain(SHORT)
    expect(markup).not.toContain('line-clamp-4')
    expect(markup).not.toContain(messages.place.detailOverviewMore)
  })

  it('긴 소개는 모바일에서만 접고 펼침 버튼을 준다', () => {
    const markup = render(LONG)

    expect(markup).toContain('line-clamp-4')
    // 데스크톱은 폭이 있어 접지 않는다
    expect(markup).toContain('md:line-clamp-none')
    expect(markup).toContain(messages.place.detailOverviewMore)
    expect(markup).toContain('md:hidden')
  })

  it('접혀 있어도 본문 전체가 DOM 에 남는다 — 잘라내는 것이 아니라 가리는 것이다', () => {
    expect(render(LONG)).toContain(LONG)
  })

  it('펼침 버튼이 본문을 가리키게 한다 (aria-controls)', () => {
    const markup = render(LONG)

    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-controls=')
  })
})
