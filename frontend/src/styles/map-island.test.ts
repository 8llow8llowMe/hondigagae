import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

/**
 * 지도 아일랜드 헤더의 CSS 스위치 — 이슈 #1287 (`docs/features/place/지도-아일랜드헤더-세부명세.md` D3-2).
 *
 * **셸이 헤더 두 벌을 함께 그리고 지도 쪽이 자기 성질(`.map-island`)로 고른다.** 규칙이 `:has()` 로
 * 지도 루트를 읽으므로, 규칙 하나가 빠지면 띠 · 알약이 함께 서거나 둘 다 사라진다 — node 환경은
 * 레이아웃을 못 보니 규칙의 모양을 소스로 잠근다.
 */
const css = readGlobalsCss()

/** 선택자로 시작하는 규칙 블록 하나 (중첩 없는 평평한 규칙) */
function rule(selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{[^}]*\\}`).exec(css)?.[0]
}

/** `@media (width >= …)` 블록 안의 규칙들 — 한 단계 중첩까지 */
function mediaBlocks(query: string): string[] {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    ...css.matchAll(new RegExp(`@media ${escaped} \\{((?:[^{}]*\\{[^}]*\\})*)\\s*\\}`, 'g')),
  ].map((m) => m[1] ?? '')
}

describe('헤더 스위치 (#1287 D3-2)', () => {
  it('아일랜드 헤더는 기본 display: none 이다 — 지도 아일랜드가 아니면 띠만 선다', () => {
    expect(rule('.island-header')).toMatch(/display:\s*none/)
  })

  it('지도 아일랜드가 있으면 띠를 걷고 알약을 세운다', () => {
    expect(rule('body:has(.map-island) .global-header')).toMatch(/display:\s*none/)
    expect(rule('body:has(.map-island) .island-header')).toMatch(/display:\s*block/)
  })

  it('오프라인 띠는 아일랜드에서 화면 맨 위 fixed · 전폭 · 알약과 같은 z-40 이다', () => {
    const banner = rule('body:has(.map-island) .offline-banner')

    expect(banner).toMatch(/position:\s*fixed/)
    expect(banner).toMatch(/inset-inline:\s*0/)
    expect(banner).toMatch(/top:\s*0/)
    expect(banner).toMatch(/z-index:\s*40/)
  })
})

describe('지도 높이 (#1287 D2-1)', () => {
  it('아일랜드는 헤더 몫을 빼지 않는다 — 모바일은 탭바만, 768 이상은 100dvh', () => {
    expect(rule('.map-canvas-height.map-island')).toMatch(
      /height:\s*calc\(100dvh - var\(--tabbar-h\)\)/,
    )
    expect(
      mediaBlocks('(width >= 48rem)').some((block) =>
        /\.map-canvas-height\.map-island\s*\{\s*height:\s*100dvh;/.test(block),
      ),
    ).toBe(true)
  })

  /* `/emergency` · 담기 지도는 후속(D7-3)이라 기존 규칙이 그대로 남아야 한다 */
  it('헤더 띠가 있는 지도의 기존 규칙은 그대로다', () => {
    expect(rule('.map-canvas-height')).toMatch(
      /height:\s*calc\(100dvh - var\(--header-h\) - var\(--tabbar-h\)\)/,
    )
    expect(
      mediaBlocks('(width >= 48rem)').some((block) =>
        /(?:^|\n)\s*\.map-canvas-height\s*\{\s*height:\s*calc\(100dvh - var\(--header-h\)\);/.test(
          block,
        ),
      ),
    ).toBe(true)
  })

  /* 루트가 `.map-canvas-height` 를 계속 달아 지도 화면의 푸터가 빠진다 (#399) */
  it('전역 푸터 규칙이 그대로다', () => {
    expect(rule('body:has(.map-canvas-height) .site-footer')).toMatch(/display:\s*none/)
  })
})

describe('시트 상한 · 로고 알약 (#1287)', () => {
  it('아일랜드 미리보기 시트 상한은 120 이고, 기본 136 은 그대로다', () => {
    expect(rule('.map-island .map-preview-sheet')).toContain(
      'max(45dvh, calc(100dvh - 120px - var(--map-sheet-tabbar)))',
    )
    expect(rule('.map-preview-sheet')).toContain(
      'max(45dvh, calc(100dvh - 136px - var(--map-sheet-tabbar)))',
    )
  })

  /* ≥1024 · 패널 접힘 — 로고가 지도 위에 맨몸으로 남지 않게 그 자리에서 알약이 된다 (D1-2) */
  it('패널이 접히면(≥1024) 로고 자리가 메뉴 알약과 같은 면 · 테두리 · 그림자의 알약이 된다', () => {
    const block = mediaBlocks('(width >= 64rem)').find((candidate) =>
      candidate.includes(".map-island[data-dock='closed']"),
    )
    const logo = /body:has\(\.map-island\[data-dock='closed'\]\) \.island-logo\s*\{[^}]*\}/.exec(
      block ?? '',
    )?.[0]

    expect(logo).toBeDefined()
    expect(logo).toMatch(/background-color:\s*var\(--bg\)/)
    expect(logo).toMatch(/border:\s*1px solid var\(--border\)/)
    expect(logo).toMatch(/border-radius:\s*var\(--radius-full\)/)
    expect(logo).toMatch(/box-shadow:\s*var\(--shadow-md\)/)
    expect(logo).toMatch(/padding-inline:\s*12px/)
    // 반투명 · 블러 금지 (D1-1)
    expect(logo).not.toMatch(/backdrop|opacity|color-mix/)
  })
})
