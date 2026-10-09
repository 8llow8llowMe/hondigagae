import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

/**
 * 지도 아일랜드 헤더의 CSS 스위치 — 이슈 #1287 · #1300 (`docs/features/place/지도-아일랜드헤더-세부명세.md` D3-2,
 * `docs/features/place/지도-아일랜드알약-정리-세부명세.md` D3-2 · D7-4).
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

  /* #1300 D1-1 — 768 미만은 알약이 없다(검색이 맨 위). 띠는 모든 폭에서 걷힌다 */
  it('지도 아일랜드가 있으면 띠를 걷고, 알약은 768 이상에서만 세운다', () => {
    expect(rule('body:has(.map-island) .global-header')).toMatch(/display:\s*none/)
    // 표시 규칙은 딱 하나이고 그것이 768 미디어 안이다 — 밖에 있으면 모바일에도 알약이 선다
    const show = /body:has\(\.map-island\) \.island-header\s*\{\s*display:\s*block;/g
    expect(css.match(show)).toHaveLength(1)
    expect(mediaBlocks('(width >= 48rem)').join('\n').match(show)).toHaveLength(1)
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

describe('시트 상한 · 핀 보정 인셋 (#1300 D1-2 · D3-2)', () => {
  it('--map-island-inset 은 기본 60 · 768 이상 120 이다', () => {
    expect(rule('.map-island')).toMatch(/--map-island-inset:\s*60px/)
    expect(
      mediaBlocks('(width >= 48rem)').some((block) =>
        /(?:^|\n)\s*\.map-island\s*\{\s*--map-island-inset:\s*120px;/.test(block),
      ),
    ).toBe(true)
  })

  it('아일랜드 미리보기 시트 상한은 변수를 쓰고, 기본 136 은 그대로다', () => {
    expect(rule('.map-island .map-preview-sheet')).toContain(
      'max(45dvh, calc(100dvh - var(--map-island-inset) - var(--map-sheet-tabbar)))',
    )
    expect(rule('.map-preview-sheet')).toContain(
      'max(45dvh, calc(100dvh - 136px - var(--map-sheet-tabbar)))',
    )
  })
})

describe('알약 허용 상자 (#1300 D1-2 · D3-2)', () => {
  it('지도 왼쪽 경계는 기본 0 · 패널 열림(≥1024) 400 · 미리보기도 열림(≥1280) 800 이다', () => {
    expect(rule('.island-header')).toMatch(/--island-map-left:\s*0px/)
    expect(
      mediaBlocks('(width >= 64rem)').some((block) =>
        /body:has\(\.map-island\[data-dock='open'\]\) \.island-header\s*\{\s*--island-map-left:\s*400px;/.test(
          block,
        ),
      ),
    ).toBe(true)
    expect(
      mediaBlocks('(width >= 80rem)').some((block) =>
        /body:has\(\.map-island\[data-dock='open'\]\[data-preview='open'\]\) \.island-header\s*\{\s*--island-map-left:\s*800px;/.test(
          block,
        ),
      ),
    ).toBe(true)
  })

  /* 로고 상자(16–148) · 지도 경계에서 16 떨어지고, 오른쪽은 콘텐츠 열 오른쪽 − 40 (#412) */
  it('.island-bar 는 fixed 컨테이너이고 왼쪽 = max(경계, 148) + 16 · 오른쪽 = 열 끝 − 40 이다', () => {
    const bar = rule('.island-bar')

    expect(bar).toMatch(/position:\s*fixed/)
    expect(bar).toMatch(/top:\s*8px/)
    expect(bar).toMatch(/container:\s*island-bar \/ inline-size/)
    expect(bar).toContain('inset-inline-start: calc(max(var(--island-map-left), 148px) + 16px)')
    expect(bar).toContain(
      'inset-inline-end: max(40px, calc((100% - var(--content-max)) / 2 + 40px))',
    )
  })

  it('허용 상자가 비로그인 알약 실측 폭보다 좁으면 메뉴 셋을 ≡ 로 접는다', () => {
    expect(rule('.island-menu-collapsed')).toMatch(/display:\s*none/)
    const query =
      /@container island-bar \(width < calc\(221px \+ 8\.625rem\)\) \{((?:[^{}]*\{[^}]*\})*)\s*\}/.exec(
        css,
      )?.[1] ?? ''

    expect(query).toMatch(/\.island-menu-full\s*\{\s*display:\s*none;/)
    expect(query).toMatch(/\.island-menu-collapsed\s*\{\s*display:\s*block;/)
  })
})

describe('로고 알약 (#1287 · #1300 D2-1)', () => {
  /* 반투명 · 블러 금지 (#1287 D1-1) — 메뉴 알약과 같은 면 · 테두리 · 그림자, 좌우 12 */
  function expectPill(logo: string | undefined) {
    expect(logo).toBeDefined()
    expect(logo).toMatch(/background-color:\s*var\(--bg\)/)
    expect(logo).toMatch(/border:\s*1px solid var\(--border\)/)
    expect(logo).toMatch(/border-radius:\s*var\(--radius-full\)/)
    expect(logo).toMatch(/box-shadow:\s*var\(--shadow-md\)/)
    expect(logo).toMatch(/padding-inline:\s*12px/)
    expect(logo).not.toMatch(/backdrop|opacity|color-mix/)
  }

  it('패널이 접히면(≥1024) 로고 자리가 알약이 된다', () => {
    const block = mediaBlocks('(width >= 64rem)').find((candidate) =>
      candidate.includes(".map-island[data-dock='closed']"),
    )
    expectPill(
      /body:has\(\.map-island\[data-dock='closed'\]\) \.island-logo\s*\{[^}]*\}/.exec(
        block ?? '',
      )?.[0],
    )
  })

  /* 768–1023 은 도킹 패널 · 로고 띠가 없다 — 로고가 늘 알약이다 */
  it('768–1023 은 로고가 늘 알약이다', () => {
    const block =
      /@media \(width >= 48rem\) and \(width < 64rem\) \{((?:[^{}]*\{[^}]*\})*)\s*\}/.exec(css)?.[1]
    expectPill(/body:has\(\.map-island\) \.island-logo\s*\{[^}]*\}/.exec(block ?? '')?.[0])
  })
})

describe('지도 도구 캡션 (#1300 D1-2 · DESIGN.md §3-2)', () => {
  it('.map-tool-caption 은 10/12 · 600 이름 있는 클래스 하나다', () => {
    const caption = rule('.map-tool-caption')

    expect(caption).toMatch(/font-size:\s*10px/)
    expect(caption).toMatch(/line-height:\s*12px/)
    expect(caption).toMatch(/font-weight:\s*600/)
  })
})
