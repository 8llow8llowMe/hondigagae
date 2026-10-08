import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AuthBrand } from '@/features/auth/auth-brand'

const markup = renderToStaticMarkup(createElement(AuthBrand, { tagline: '반려견과 함께' }))

describe('AuthBrand — 인증 화면의 서비스 표식 (#532 → #1283)', () => {
  it('브랜드 락업이다 — 워드마크가 이름을 든다', () => {
    // 워드마크는 라이브 텍스트가 아니라 아웃라인 SVG 다 (브랜드 명세 B4)
    expect(markup).toContain('<title>혼디가개</title>')
    expect(markup).toContain('aria-label="혼디가개"')
  })

  it('홈으로 가는 링크다', () => {
    expect(markup).toMatch(/<a[^>]*href="\/"/)
  })

  /* 링크에 이름을 또 붙이면 스크린리더가 두 번 읽는다 — 브랜드 명세 B4 */
  it('링크가 자기 aria-label 을 갖지 않는다 — 이름은 워드마크가 준다', () => {
    const anchor = markup.slice(markup.indexOf('<a'), markup.indexOf('>', markup.indexOf('<a')) + 1)

    expect(anchor).not.toContain('aria-label')
    expect(markup.match(/aria-label="혼디가개"/g)).toHaveLength(1)
  })

  it('심볼은 aria-hidden 이다', () => {
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  /* 44 기준은 지키되 48 심볼이 잘리지 않게 최소값이다 (DESIGN.md §7) */
  it('로고 링크가 최소 터치 영역을 갖되 내용에 따라 자란다', () => {
    expect(markup).toMatch(/<a[^>]*class="[^"]*\bmin-h-11\b/)
    expect(markup).not.toMatch(/<a[^>]*class="[^"]*[\s"]h-11\b/)
  })

  /* `DESIGN.md` §1 개정 — 헤더(24 · 20×74)의 정확히 2배. 두 값이 같은 배율이어야 비율이 산다 */
  it('심볼 48 · 워드마크 40×148 이다', () => {
    expect(markup).toMatch(/<svg[^>]*width="48"[^>]*height="48"/)
    expect(markup).toMatch(/<svg[^>]*height="40"[^>]*width="148"/)
  })

  it('한 줄 소개를 락업 아래에 둔다', () => {
    expect(markup.indexOf('반려견과 함께')).toBeGreaterThan(markup.indexOf('</a>'))
  })
})
