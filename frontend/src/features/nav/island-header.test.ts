import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'

/**
 * 지도 아일랜드 헤더 — 이슈 #1287 (`docs/features/place/지도-아일랜드헤더-세부명세.md` D3-1 · D6 · D7-4).
 *
 * 목은 `global-header.test.ts` 와 같다 — 자식(`NavLinks` · `PetSwitcherSlot` · `AccountMenu`)이 라우터 ·
 * React Query 를 요구한다. 경로는 활성 판정 때문에 바꿀 수 있게 둔다.
 */
const pathname = { current: '/places' }
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))
vi.mock('@/features/nav/pet-switcher-slot', () => ({ PetSwitcherSlot: () => null }))
vi.mock('@/features/nav/account-menu', () => ({ AccountMenu: () => null }))

const { IslandHeader } = await import('@/features/nav/island-header')
const { GlobalHeader } = await import('@/features/nav/global-header')
const { HeaderActions } = await import('@/features/nav/header-parts')

function render(authed: boolean, path = '/places') {
  pathname.current = path
  return renderToStaticMarkup(createElement(IslandHeader, { authed }))
}

function classList(open: string | undefined) {
  return new Set(/class="([^"]*)"/.exec(open ?? '')?.[1]?.split(/\s+/) ?? [])
}

/** 마크업의 여는 태그 중 조건에 맞는 첫 것 — 마크업 전체가 아니라 그 태그 하나로 범위를 좁힌다 */
function openTag(markup: string, match: (open: string) => boolean) {
  return [...markup.matchAll(/<[a-z]+ [^>]*>/g)].map((m) => m[0]).find(match)
}

const isPill = (open: string) => open.startsWith('<div ') && classList(open).has('rounded-full')

describe.each([
  ['비로그인', false],
  ['로그인', true],
] as const)('IslandHeader — %s', (_, authed) => {
  it('배너 하나다 — <header> 1개 · island-header 훅 · 주요 nav · 로고', () => {
    const markup = render(authed)

    expect(markup.match(/<header\b/g)).toHaveLength(1)
    expect(
      classList(openTag(markup, (open) => open.startsWith('<header'))).has('island-header'),
    ).toBe(true)
    expect(markup).toContain('<nav aria-label="주요"')
    expect(markup).toMatch(/<a [^>]*href="\/"/)
  })

  it('/places 에서 장소 찾기가 켜진다 — 헤더와 같은 aria-current', () => {
    const active = openTag(
      render(authed),
      (open) => open.startsWith('<a ') && open.includes('href="/places"'),
    )

    expect(active).toContain('aria-current="page"')
  })

  it('메뉴 순서가 헤더와 같다 — 장소 찾기 → 여행 일정 → AI 일정 생성', () => {
    const markup = render(authed)
    const order = ['장소 찾기', '여행 일정', 'AI 일정 생성'].map((label) => markup.indexOf(label))

    expect(order[0]).toBeGreaterThan(-1)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('알약은 불투명 흰 면 + 테두리 + 그림자 · 높이 48 · rounded-full 이다', () => {
    const pill = classList(openTag(render(authed), isPill))

    for (const name of [
      'rounded-full',
      'bg-bg',
      'border',
      'border-border',
      'shadow-md',
      'h-12',
      'pointer-events-auto',
    ])
      expect(pill.has(name)).toBe(true)
  })

  /* 반투명 · 블러는 바다 위에서 대비를 잃는다 (D1-1 · D6) */
  it('반투명 · 블러가 없다', () => {
    const markup = render(authed)

    expect(markup).not.toContain('bg-bg/')
    expect(markup).not.toContain('backdrop-')
    expect(markup).not.toMatch(/\bblur\b/)
  })

  /*
    **`fixed` 로고의 조상에 transform · filter 를 걸지 않는다** (D3-1 · D7-7). 걸리면 로고의 기준이 뷰포트가
    아니라 그 조상이 되어 로고가 알약 안으로 끌려 들어간다. 로고 링크 앞의 여는 태그가 곧 그 조상이다.
  */
  it('로고의 조상(header · 열 · 알약 · 로고 자리)에 transform · filter 가 없다', () => {
    const markup = render(authed)
    const ancestors = markup.slice(0, markup.indexOf('href="/"'))
    const tags = [...ancestors.matchAll(/<[a-z]+ [^>]*>/g)].map((m) => m[0])

    expect(tags.length).toBeGreaterThanOrEqual(5)
    for (const tag of tags)
      expect(tag).not.toMatch(
        /\b(transform|translate-|-translate-|scale-|rotate-|filter|blur|backdrop-|will-change)/,
      )
  })

  it('≥1024 에서 로고가 알약 밖 왼쪽 위(16 · 8 · 높이 48)로 빠진다', () => {
    const logo = classList(openTag(render(authed), (open) => classList(open).has('island-logo')))

    for (const name of ['lg:fixed', 'lg:start-4', 'lg:top-2', 'lg:h-12', 'items-center'])
      expect(logo.has(name)).toBe(true)
  })

  it('바깥 header 는 fixed · 위 8 · z-40 이고 지도 드래그를 먹지 않는다 — 표시는 CSS 가 정한다', () => {
    const header = classList(openTag(render(authed), (open) => open.startsWith('<header')))

    for (const name of ['fixed', 'top-2', 'z-40', 'pointer-events-none'])
      expect(header.has(name)).toBe(true)
    // `display` 는 `.island-header` · `body:has(.map-island)` 규칙이 갖는다 — 유틸리티가 끼면 순서 싸움이 된다
    for (const name of ['hidden', 'block', 'flex']) expect(header.has(name)).toBe(false)
  })

  /* 1920 에서 알약 · 조작 줄 오른쪽 끝이 같은 열 끝(1640)에 맞는다 (#412) */
  it('알약 열이 content-container 와 페이지 인셋을 쓴다', () => {
    const column = classList(
      openTag(render(authed), (open) => classList(open).has('content-container')),
    )

    expect(column.has('px-4')).toBe(true)
    expect(column.has('md:px-10')).toBe(true)
    expect(column.has('justify-end')).toBe(true)
  })

  /* "로고 · 메뉴 이름 · 순서 · 로그인 버튼 모양 동일" — 구조로 지킨다 (D1-1) */
  it('오른쪽 묶음 마크업이 띠 헤더와 같다', () => {
    pathname.current = '/places'
    const actions = renderToStaticMarkup(createElement(HeaderActions, { authed }))
    const island = render(authed)
    const band = renderToStaticMarkup(createElement(GlobalHeader, { authed }))

    expect(actions.length).toBeGreaterThan(0)
    expect(island).toContain(actions)
    expect(band).toContain(actions)
  })
})

describe('IslandHeader — 비로그인 갈래', () => {
  it('헤더와 같다 — 모바일 로그인 링크 · 데스크톱 로그인 · 회원가입 · 서비스 소개', () => {
    const markup = render(false)

    expect(markup.split('href="/login"')).toHaveLength(3)
    expect(markup).toContain('href="/signup"')
    expect(markup).toContain('href="/about"')
  })

  it('긴급 링크를 둔다 — 지도에서 /emergency 로 가는 길이다 (D8-2 A)', () => {
    expect(render(false)).toContain('aria-label="병원 · 약국"')
  })
})

describe('헤더 두 벌이 같은 조각을 쓴다 (#1287)', () => {
  it('GlobalHeader · IslandHeader 둘 다 header-parts 의 로고 · 오른쪽 묶음을 쓴다', () => {
    for (const path of [
      'src/features/nav/global-header.tsx',
      'src/features/nav/island-header.tsx',
    ]) {
      const source = readSourceWithoutComments(path)

      expect(source).toContain('<HeaderLogo />')
      expect(source).toContain('<HeaderActions authed={authed} />')
      expect(source).toContain('<NavLinks authed={authed} />')
      // 조각을 다시 적지 않는다 — 한쪽만 고쳐지는 날 "내용 동일" 이 깨진다
      expect(source).not.toContain('href="/emergency"')
      expect(source).not.toContain('<Wordmark')
    }
  })
})
