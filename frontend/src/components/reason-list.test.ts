import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ReasonList } from '@/components/reason-list'

const FIVE = [
  { description: '첫째 근거' },
  { description: '둘째 근거' },
  { description: '셋째 근거' },
  { description: '넷째 근거' },
  { description: '다섯째 근거' },
]

function render(reasons: { description: string; informational?: boolean }[]) {
  return renderToStaticMarkup(createElement(ReasonList, { reasons }))
}

/* 접기를 걷었다 (#840) — 아끼는 것이 한 줄인데 버튼이 44px 이라 순손실이었다 */
describe('ReasonList — 근거를 접지 않는다', () => {
  it('다섯 개를 주면 다섯 개가 다 선다', () => {
    const html = render(FIVE)

    for (const reason of FIVE) {
      expect(html).toContain(reason.description)
    }
  })

  it('펼침·접기 버튼을 그리지 않는다', () => {
    const html = render(FIVE)

    expect(html).not.toContain('<button')
    expect(html).not.toContain('aria-expanded')
  })

  /*
    **항목별 마크업을 갈라서 본다.** `toContain('text-fg"')` 로 보면 `cn()` 이 내놓는
    클래스 **순서**에 기대게 되어, 외형이 그대로여도 정렬만 바뀌면 깨지는 단언이 된다.
    여기서 증명해야 하는 것은 "두 종류가 다르게 렌더된다" 하나다.
  */
  it('정보성 근거만 한 단계 흐리다', () => {
    const html = render([
      { description: '감점 근거' },
      { description: '정보 근거', informational: true },
    ])

    const items = html.match(/<li[^>]*>[^<]*<\/li>/g) ?? []

    expect(items).toHaveLength(2)

    expect(items[0]).toContain('감점 근거')
    expect(items[0]).not.toContain('text-fg-muted')

    expect(items[1]).toContain('정보 근거')
    expect(items[1]).toContain('text-fg-muted')
  })

  it('근거가 없으면 아무것도 그리지 않는다', () => {
    expect(render([])).toBe('')
  })
})
