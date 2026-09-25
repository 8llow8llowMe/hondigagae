import { describe, expect, it } from 'vitest'

import { TOUR_MEDIA, TOUR_STEP, tourIndexAt } from '@/features/about/feature-tabs'
import { readSourceWithoutComments } from '@/test/source'
import { readGlobalsCss } from '@/test/tokens'

/**
 * 질문 3 목록 — 스크롤이 한 항목씩 넘긴다 (#940, 설계 명세 2026-09-25 §3-5).
 *
 * 훅은 node 에서 돌릴 수 없어 셋을 잠근다 — 스크롤 거리 → 항목 식, CSS 트랙과 재는 조건이 같은지,
 * 누른 값과 스크롤 위치가 갈리지 않는 소스 조각.
 */
describe('tourIndexAt — 트랙 윗변에서 지나온 거리 → 항목', () => {
  const step = 280
  it.each([
    ['트랙이 아직 헤더 아래 — 첫 항목', -500, 0],
    ['막 붙었다', 0, 0],
    ['첫 칸 끝 직전', 279, 0],
    ['둘째 칸', 280, 1],
    ['넷째 칸', 900, 3],
    ['트랙을 지나왔다 — 마지막에서 멈춘다', 5000, 3],
  ] as const)('%s', (_, scrolled, expected) => {
    expect(tourIndexAt(scrolled, step, 4)).toBe(expected)
  })

  it('칸 길이가 0 이면 첫 항목 — 나눗셈이 무한대로 가지 않는다', () => {
    expect(tourIndexAt(100, 0, 4)).toBe(0)
  })
})

describe('globals.css 질문 3 트랙', () => {
  const css = readGlobalsCss().replace(/\/\*[\s\S]*?\*\//g, '')

  it('트랙이 길어지는 미디어 쿼리가 컴포넌트가 재는 조건(TOUR_MEDIA)과 같은 문자열이다', () => {
    expect(css).toContain(`@media ${TOUR_MEDIA} {`)
    const open = `@media ${TOUR_MEDIA} {`
    const block = css.slice(css.indexOf(open) + open.length)
    expect(block).toMatch(/^[^@]*\.about-tour \{/)
    expect(block).toMatch(/^[^@]*\.about-tour-sticky \{[^}]*position: sticky;/)
  })

  it('칸 길이가 TOUR_STEP 과 같다', () => {
    expect(css).toMatch(
      new RegExp(`\\.about-tour \\{\\s*--about-tour-step: ${Math.round(TOUR_STEP * 100)}vh;`),
    )
  })

  it('트랙 높이 = 한 화면 + 항목 수 × 칸 — 마지막 항목 뒤에 붙임이 풀린다', () => {
    expect(css).toContain(
      'block-size: calc(100dvh - var(--header-h) + var(--about-tour-count) * var(--about-tour-step));',
    )
  })

  it('1024 이상 예시 카드 최소 높이 — 넘길 때 카드가 늘었다 줄었다 하지 않게', () => {
    expect(css).toMatch(/\.about-tab-card \{\s*min-block-size: \d+(\.\d+)?rem;/)
  })

  it('덩어리 최소 높이가 카드보다 크다 — 목록 쪽 설명 줄 수가 달라도 덩어리가 튀지 않게', () => {
    const card = Number(css.match(/\.about-tab-card \{\s*min-block-size: ([\d.]+)rem;/)?.[1])
    const grid = Number(css.match(/\.about-tour-grid \{\s*min-block-size: ([\d.]+)rem;/)?.[1])
    expect(grid).toBeGreaterThan(card)
  })
})

describe('FeatureTabs — 소스 가드', () => {
  const source = readSourceWithoutComments('src/features/about/feature-tabs.tsx')

  it('스크롤은 useScrollFrame(passive + rAF) 하나로 잰다', () => {
    expect(source).toContain('useScrollFrame(')
    expect(source).not.toContain("addEventListener('scroll'")
  })

  it('누르면 그 항목의 스크롤 자리로 간다 — 가는 동안 목표를 쥔다', () => {
    expect(source).toContain('window.scrollTo(')
    expect(source).toContain('pending.current = { index')
  })

  it('트랙이 넘길 때만 포커스가 페이지를 스크롤하지 않는다 — 1024 미만 칩 레일은 따라가야 한다 (#940 검토)', () => {
    expect(source).toContain('focus(driven ? { preventScroll: true } : undefined)')
    expect(source).toContain(
      "if (!driven) tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })",
    )
  })

  it('스크롤로 항목이 바뀌면 사라질 패널 안의 포커스를 새 탭으로 옮긴다 (#940 검토)', () => {
    expect(source).toContain("active.closest('.about-tab-panel') !== null")
    expect(source).toMatch(
      /if \(lostFocus && node\.contains\(active\)\) tabs\.current\[index\]\?\.focus\(\{ preventScroll: true \}\)/,
    )
  })

  it('헤더 높이는 매 프레임이 아니라 마운트 · resize 에서만 읽는다', () => {
    // 정의 하나 + 읽는 곳 하나(readHeader)
    expect(source.match(/readHeaderHeight\(\)/g)).toHaveLength(2)
    expect(source).toContain("window.addEventListener('resize', readHeader)")
    expect(source).toContain("window.removeEventListener('resize', readHeader)")
  })

  it('시간으로 넘기지 않는다 — 타이머가 없다 (WCAG 2.2.2)', () => {
    expect(source).not.toMatch(/setInterval|setTimeout/)
  })
})
