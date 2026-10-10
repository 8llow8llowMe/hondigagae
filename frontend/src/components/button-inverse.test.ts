import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ButtonLink } from '@/components/button'

/**
 * 그린 밴드(`--brand-700`) 위에 서는 두 변형 — 소개 페이지 전용 (DESIGN.md §0-2, #635).
 * `className` 으로 외형을 덮지 않고 변형을 낸다 (`component-guide.md` §3).
 */
describe('Button — inverse 변형', () => {
  it('inverse 는 흰 면 + brand-700 글자다', () => {
    const markup = renderToStaticMarkup(
      createElement(ButtonLink, { href: '/', variant: 'inverse', children: '홈으로 가기' }),
    )
    expect(markup).toContain('bg-bg')
    expect(markup).toContain('text-brand-700')
    expect(markup).not.toContain('text-fg-inverse')
  })

  it('inverseOutline 은 투명 면 + 흰 글자 + 흰 테두리다', () => {
    const markup = renderToStaticMarkup(
      createElement(ButtonLink, {
        href: '/places',
        variant: 'inverseOutline',
        children: '장소 찾기',
      }),
    )
    expect(markup).toContain('text-fg-inverse')
    expect(markup).toContain('border-fg-inverse/55')
    expect(markup).not.toContain('bg-bg')
  })
})
