import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as code } from '@/test/source'

/**
 * #1404 — 홈 추천 레일의 끌기 · 끝 흐림 없음 · 화살표 표시 (`app/globals.css`).
 *
 * 레이아웃 · 마스크는 node 환경에서 그릴 수 없어 규칙을 소스로 잠근다. 실측(헤드리스 Chromium 1440 · 390)은 PR 에 있다.
 */
const css = code('app/globals.css')
const rail = code('src/components/scroll-rail.tsx')

describe('끄는 동안 스냅 끔 (#1404)', () => {
  /* 클래스면 끄는 중 리렌더(fade 방향 변경)가 `className` 을 다시 써 지운다 — 스냅이 돌아와 0 으로 튕겼다 */
  it('상태는 클래스가 아니라 data-dragging 속성이다', () => {
    expect(rail).toContain('el.dataset.dragging = ')
    expect(rail).not.toContain("classList.add('drag-scrolling')")
    expect(css).toMatch(/\.drag-scroll\[data-dragging\]\s*\{\s*scroll-snap-type:\s*none;/)
  })

  /* 놓자마자 스냅을 켜면 브라우저가 가까운 칸에 먼저 붙어 고른 칸으로 가지 못했다 */
  it('스냅은 scrollend(또는 안전망) 뒤에 되돌린다', () => {
    expect(rail).toContain("el.addEventListener('scrollend', releaseSnap)")
    expect(rail).toContain('setTimeout(releaseSnap, DRAG_SETTLE_FALLBACK_MS)')
  })

  it('잡는 커서는 마우스 환경에만 선다', () => {
    expect(css).toMatch(/@media \(pointer: fine\)\s*\{\s*\.drag-scroll\s*\{\s*cursor:\s*grab;/)
  })
})

/* 넓힌 흐림을 시도했다가 걷었다 (사용자 평가 2026-10-12) — 이 레일 전용 마스크가 남지 않는다 */
describe('홈 레일 끝 흐림 없음 (#1404)', () => {
  it('scroll-fade-wide 규칙이 없고 공용 48px 는 그대로다', () => {
    expect(css).not.toContain('scroll-fade-wide')
    expect(css).toMatch(/--scroll-fade-w:\s*48px;/)
  })
})

/* #1404 — 홈 레일 화살표: 데스크톱은 호버 · 포커스에만, 태블릿 · 모바일은 늘. 꺾쇠는 굵게 */
describe('홈 레일 화살표 (#1404)', () => {
  const card = code('src/features/home/place-insight-card.tsx')

  it('홈 레일만 reveal="hover" 이고 기본은 mouse 다', () => {
    expect(card).toContain('reveal="hover"')
    expect(rail).toContain("reveal = 'mouse'")
    expect(rail).toContain("reveal === 'hover' ? 'scroll-rail-arrow-hover' : 'scroll-rail-arrow'")
  })

  /* display:none 이면 Tab 이 닿지 않는다 — opacity 로 감추고 focus-within 으로 드러낸다 */
  it('1024+ 호버 환경에서만 감추고, 레일 호버 · 포커스로 드러난다', () => {
    expect(css).toMatch(
      /@media \(width >= 64rem\) and \(hover: hover\)\s*\{\s*\.scroll-rail-arrow-hover\s*\{\s*opacity:\s*0;\s*pointer-events:\s*none;/,
    )
    expect(css).toContain('.scroll-rail:hover .scroll-rail-arrow-hover')
    expect(css).toContain('.scroll-rail:focus-within .scroll-rail-arrow-hover')
  })

  /* 터치 숨김(.scroll-rail-arrow)을 따르지 않는다 — 태블릿 · 모바일에서 늘 선다 */
  it('hover 화살표는 터치 숨김 규칙에 걸리지 않는다', () => {
    const coarse = /@media \(pointer: coarse\)\s*\{([^}]*\})\s*\}/.exec(css)?.[1] ?? ''
    expect(coarse).toContain('.scroll-rail-arrow {')
    expect(coarse).not.toContain('scroll-rail-arrow-hover')
  })

  it('꺾쇠는 사용처가 굵기 2.25 를 넘긴다 — 아이콘 기본값은 그대로다', () => {
    expect(rail).toContain('const ARROW_STROKE = 2.25')
    expect(rail.match(/strokeWidth=\{ARROW_STROKE\}/g)).toHaveLength(2)
    expect(code('src/components/icons/index.tsx')).toContain('strokeWidth={1.5}')
  })
})
