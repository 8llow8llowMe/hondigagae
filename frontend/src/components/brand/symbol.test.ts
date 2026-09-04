import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { BrandSymbol } from '@/components/brand/symbol'

describe('BrandSymbol — 헤더에 허용된 유일한 채도 (#240)', () => {
  /*
    `DESIGN.md` §1 은 "채도를 데이터에만 남긴다" 고 정하고 이전에는 그 규칙을 헤더
    로고까지 적용했다. 그 결정을 뒤집었으므로 **판정 색과 경쟁하지 않는 것**이 조건이다.
  */
  it('브랜드 토큰 하나만 쓴다 — 판정 등급 색도, raw 색상값도 쓰지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(BrandSymbol))

    expect(markup).toContain('var(--brand-500)')
    expect(markup).not.toMatch(/metric-|danger|critical/)
    // raw 색상값은 이 저장소가 린트로 막는다 — 테스트로도 잠근다
    expect(markup).not.toMatch(/#[0-9A-Fa-f]{6}/)
  })

  /** 커지면 헤더가 브랜드 배너가 된다 — 24px 로 묶는다 */
  it('24px 로 묶는다', () => {
    const markup = renderToStaticMarkup(createElement(BrandSymbol))

    expect(markup).toContain('width="24"')
    expect(markup).toContain('height="24"')
  })

  /**
   * 이름은 옆의 워드마크가 `aria-label` 로 들고 있다. 여기서 또 이름을 주면
   * 스크린리더가 "혼디가개" 를 두 번 읽는다.
   */
  it('보조기기에는 이름을 남기지 않는다 — 워드마크가 이미 말한다', () => {
    const markup = renderToStaticMarkup(createElement(BrandSymbol))

    expect(markup).toContain('aria-hidden="true"')
    expect(markup).not.toContain('aria-label')
  })
})
