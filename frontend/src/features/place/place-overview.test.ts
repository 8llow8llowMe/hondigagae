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

  /* 모바일 기준(140)은 넘지만 데스크톱 세 줄(240)엔 드는 길이 */
  const MEDIUM = 'ㄱ'.repeat(180)

  it('중간 길이는 모바일에서만 접고 데스크톱 버튼은 숨긴다', () => {
    const markup = render(MEDIUM)

    expect(markup).toContain('line-clamp-4')
    expect(markup).toContain('md:line-clamp-none')
    expect(markup).toContain(messages.place.detailOverviewMore)
    expect(markup).toContain('md:hidden')
  })

  /* 제목 카드 안에 들어가 전문이 반려견 동반 정보를 밀어내지 않게 한다 (#935) */
  it('아주 긴 소개는 데스크톱에서도 세 줄로 접고 버튼을 남긴다', () => {
    const VERY_LONG = SHORT.repeat(20)
    expect(VERY_LONG.length).toBeGreaterThan(240)
    const markup = render(VERY_LONG)

    expect(markup).toContain('line-clamp-4')
    expect(markup).toContain('md:line-clamp-3')
    expect(markup).not.toContain('md:line-clamp-none')
    expect(markup).toContain(messages.place.detailOverviewMore)
    expect(markup).not.toContain('md:hidden')
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
