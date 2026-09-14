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

  /**
   * 커지면 헤더가 브랜드 배너가 된다 — **기본값이 24px 이어야** 호출부가 크기를 정하지
   * 않은 모든 자리(헤더·푸터)가 조건 안에 남는다.
   */
  it('기본 크기가 24px 다', () => {
    const markup = renderToStaticMarkup(createElement(BrandSymbol))

    expect(markup).toContain('width="24"')
    expect(markup).toContain('height="24"')
  })

  /**
   * `(auth)` 셸 전용 크기 — `DESIGN.md` §1 개정. 조건을 숫자 하나에서 **자리**로 옮겼고,
   * 임의 크기는 `size` 열거(24 | 48)가 타입으로 막는다.
   */
  it('48px 은 정사각을 유지한다 — 폭만 커지면 심볼이 눌린다', () => {
    const markup = renderToStaticMarkup(createElement(BrandSymbol, { size: 48 }))

    expect(markup).toContain('width="48"')
    expect(markup).toContain('height="48"')
    // viewBox 가 그대로여야 48 에서도 같은 모양이다 — 라운드 사각이 따라 커진다
    expect(markup).toContain('viewBox="0 0 32 32"')
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
