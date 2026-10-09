import { describe, expect, it } from 'vitest'

import { readGlobalsCss } from '@/test/tokens'

const css = readGlobalsCss()
const block = (selector: string) =>
  new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\}`).exec(
    css,
  )?.[1] ?? ''

describe('원 핀 CSS (#1280)', () => {
  it('기본 원은 26 · 브랜드 채움 · 흰 테두리 2 · 원형이다', () => {
    const rule = block('.map-pin-dot')

    expect(rule).toContain('width: 26px')
    expect(rule).toContain('height: 26px')
    expect(rule).toContain('background: var(--brand-600)')
    expect(rule).toContain('border: 2px solid var(--bg)')
    expect(rule).toContain('border-radius: var(--radius-full)')
  })

  /* 패딩 박스 22(26 − 테두리 2×2) + 11×2 = 44 — §0-4 의 계산 방식 */
  it('누르는 자리가 44 다', () => {
    expect(block('.map-pin-dot::before')).toContain('inset: -11px')
    expect(block('.map-pin-dot-selected::before')).toContain('inset: -7px')
  })

  it('묶음 테두리가 2 가 돼도 누르는 자리는 44 다 — 패딩 박스 28 + 8 × 2', () => {
    expect(block('.map-cluster::before')).toContain('inset: -8px')
  })

  it('선택은 34 · --fg 채움이다', () => {
    const rule = block('.map-pin-dot-selected')

    expect(rule).toContain('width: 34px')
    expect(rule).toContain('background: var(--fg)')
  })

  it('이름 알약은 원 상자 밖에 매달린다 — 이름이 서도 원이 움직이지 않는다', () => {
    expect(block('.map-pin-dot > span')).toContain('position: absolute')
  })

  /* `display: none` 이면 버튼의 접근 이름이 사라진다 (Review Focus) */
  it('숨은 이름은 시각적으로만 숨긴다 — display: none 을 쓰지 않는다', () => {
    const hidden =
      /\.map-pin-dot:not\(\.map-pin-dot-named\)[^{]*\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''

    expect(hidden).toContain('clip-path: inset(50%)')
    expect(hidden).not.toContain('display: none')
  })

  it('호버 · 키보드 포커스에서 이름을 연다', () => {
    expect(css).toMatch(
      /\.map-pin-dot:not\(\.map-pin-dot-named\):not\(:hover\):not\(:focus-visible\) > span/,
    )
  })

  it('포커스 링이 원 핀에도 선다', () => {
    expect(css).toMatch(/\.map-pin-dot:focus-visible/)
  })

  /* #789 — 못 누르는 핀에 손 모양 · 보이지 않는 44 상자를 남기지 않는다 */
  it('누를 수 없는 원 핀은 손 모양도 44 누르는 자리도 없다', () => {
    expect(block('.map-pin-dot.map-pin-static')).toContain('cursor: default')
    expect(block('.map-pin-dot.map-pin-static::before')).toContain('content: none')
  })

  /*
    기준점 이름표(`yAnchor 0` — 윗변이 좌표)는 같은 좌표의 원 핀보다 아래 층이다(`MAP_LAYER_Z.focus`).
    원이 좌표 중심에 서므로 가장 큰 원(고른 원 34 → 반지름 17)의 아랫변보다 4 아래에서 시작해야
    원에 덮이지 않는다. 이름 알약(반높이 ≈ 13.5)도 그 안이다.
  */
  it('기준점 이름표는 가장 큰 원 아래(반지름 17 + 4)에 선다', () => {
    const rule = block('.map-pin-focus')

    expect(rule).toContain('transform: translateY(calc(17px + 4px))')
    expect(rule).not.toContain('translateY(6px)')
  })
})

describe('시설 사각 CSS (#1286 D2-5)', () => {
  /* 두 클래스 선택자 — `.map-pin-dot-selected` 단독(34)보다 특이도가 높아야 이긴다 */
  it('기본 사각은 24 · --radius-sm 이고 원 핀 위에 두 클래스로 얹는다', () => {
    const rule = block('.map-pin-dot.map-pin-dot-square')

    expect(rule).toContain('width: 24px')
    expect(rule).toContain('height: 24px')
    expect(rule).toContain('border-radius: var(--radius-sm)')
  })

  it('고른 사각은 32 다', () => {
    const rule = block('.map-pin-dot-square.map-pin-dot-selected')

    expect(rule).toContain('width: 32px')
    expect(rule).toContain('height: 32px')
  })

  /* 패딩 박스 20 + 12 × 2 = 44 · 고른 사각 28 + 8 × 2 = 44 */
  it('누르는 자리가 44 다', () => {
    expect(block('.map-pin-dot.map-pin-dot-square::before')).toContain('inset: -12px')
    expect(block('.map-pin-dot-square.map-pin-dot-selected::before')).toContain('inset: -8px')
  })

  /* 고른 사각 규칙이 기본 사각 규칙보다 뒤에 와야 32 가 이긴다 — 특이도가 같다 */
  it('고른 사각 규칙이 기본 사각 규칙 뒤에 있다', () => {
    expect(css.indexOf('\n.map-pin-dot-square.map-pin-dot-selected {')).toBeGreaterThan(
      css.indexOf('\n.map-pin-dot.map-pin-dot-square {'),
    )
  })

  it('채움 · 테두리 · 이름 알약은 덮지 않는다 — 원 핀 규칙을 물려받는다', () => {
    const rule = block('.map-pin-dot.map-pin-dot-square')

    expect(rule).not.toContain('background')
    expect(rule).not.toContain('border:')
  })
})

describe('시설 사각 묶음 CSS (#1286 D2-3)', () => {
  it('사각 30 · --radius-sm 이다', () => {
    const rule = block('.map-cluster.map-cluster-square')

    expect(rule).toContain('width: 30px')
    expect(rule).toContain('height: 30px')
    expect(rule).toContain('border-radius: var(--radius-sm)')
  })

  /* 패딩 박스 26 + 9 × 2 = 44 */
  it('누르는 자리가 44 다', () => {
    expect(block('.map-cluster.map-cluster-square::before')).toContain('inset: -9px')
  })

  it('겹친 모양도 같은 모서리의 사각이다', () => {
    expect(block('.map-cluster.map-cluster-square::after')).toContain(
      'border-radius: var(--radius-sm)',
    )
  })
})
