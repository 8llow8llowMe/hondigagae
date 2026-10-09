import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'

/**
 * 지도 아일랜드 헤더 — 이슈 #1287 → #1300 (`docs/features/place/지도-아일랜드알약-정리-세부명세.md` D3-1 · D6 ·
 * D7-4).
 *
 * 알약 = 메뉴 셋 + 계정 하나. 띠 헤더의 오른쪽 묶음(`HeaderActions`)을 쓰지 않는다 — 그래서 #1287 의 "헤더와 같은
 * 조각" 단언은 걷었다(D7-4).
 *
 * 목: 자식(`NavLinks` · `IslandLoginLink`)이 라우터를 요구한다. `AccountMenu` 는 React Query 를 요구해 **variant 와
 * 트리거 모양만 흉내 낸 대역**으로 바꾼다 — 실제 트리거 클래스는 아래 `AccountMenu variant` 절이 소스로 본다.
 */
const pathname = { current: '/places' }
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))
vi.mock('@/features/nav/pet-switcher-slot', () => ({ PetSwitcherSlot: () => null }))
vi.mock('@/features/nav/account-menu', async () => {
  const { createElement: h } = await import('react')
  return {
    AccountMenu: ({ variant }: { variant?: string }) =>
      h('button', { type: 'button', 'data-account-variant': variant ?? 'header' }),
  }
})

const { IslandHeader } = await import('@/features/nav/island-header')

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

/** 알약 — 허용 상자(`island-bar`) 바로 안의 둥근 면 */
function pillTag(markup: string) {
  const bar = markup.indexOf('class="island-bar"')
  return openTag(markup.slice(bar + 1), (open) => open.startsWith('<div '))
}

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

  it('메뉴 셋이 순서대로다 — 장소 찾기 → 여행 일정 → AI 일정 생성', () => {
    const markup = render(authed)
    const order = ['장소 찾기', '여행 일정', 'AI 일정 생성'].map((label) => markup.indexOf(label))

    expect(order[0]).toBeGreaterThan(-1)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  /* 알약 안 칩은 바깥과 동심원이다 — 사각(8) 칩이 알약 곡선과 어긋났다 (D0 #1) */
  it('/places 활성 칩이 aria-current 이고 40 원형이다', () => {
    const active = openTag(render(authed), (open) => open.includes('aria-current="page"'))
    const chip = classList(active)

    expect(active).toContain('href="/places"')
    for (const name of ['h-10', 'rounded-full', 'px-3', 'text-body-2', 'bg-band'])
      expect(chip.has(name)).toBe(true)
    expect(chip.has('rounded-md')).toBe(false)
  })

  it('알약은 불투명 흰 면 + inset 테두리 + 그림자 · 높이 48 · 여백 4 · rounded-full 이다', () => {
    const pill = classList(pillTag(render(authed)))

    for (const name of [
      'rounded-full',
      'bg-bg',
      'inset-ring',
      'inset-ring-border',
      'shadow-md',
      'h-12',
      'p-1',
      'ms-auto',
      'w-max',
      'max-w-full',
      'pointer-events-auto',
    ])
      expect(pill.has(name)).toBe(true)
    // 테두리가 레이아웃을 먹으면 안쪽 40 이 38 이 된다
    expect(pill.has('border')).toBe(false)
  })

  /* 반투명 · 블러는 바다 위에서 대비를 잃는다 (#1287 D1-1 · D6) */
  it('반투명 · 블러가 없다', () => {
    const markup = render(authed)

    expect(markup).not.toContain('bg-bg/')
    expect(markup).not.toContain('backdrop-')
    expect(markup).not.toMatch(/\bblur\b/)
  })

  /*
    **로고는 허용 상자(`island-bar`) 밖 형제다** (D3-1 · D7-7). `container-type` 은 `fixed` 자손의 기준 상자가 되어
    로고를 허용 상자 안으로 끌고 들어간다. 로고 자리가 허용 상자보다 **먼저 닫혀야** 한다.
  */
  it('로고 상자가 island-bar 밖이다 — 허용 상자가 열리기 전에 닫힌다', () => {
    const markup = render(authed)
    const logoOpen = markup.indexOf('island-logo')
    const logoClose = markup.indexOf('</div>', markup.indexOf('href="/"'))
    const barOpen = markup.indexOf('class="island-bar"')

    expect(logoOpen).toBeGreaterThan(-1)
    expect(barOpen).toBeGreaterThan(-1)
    expect(logoClose).toBeLessThan(barOpen)
  })

  it('로고는 왼쪽 16 · 위 8 · 높이 48 에 fixed 로 선다 — 모든 표시 폭에서', () => {
    const logo = classList(openTag(render(authed), (open) => classList(open).has('island-logo')))

    for (const name of ['fixed', 'start-4', 'top-2', 'h-12', 'items-center', 'pointer-events-auto'])
      expect(logo.has(name)).toBe(true)
  })

  it('로고 · 허용 상자의 조상에 transform · filter 가 없다', () => {
    const markup = render(authed)
    const ancestors = markup.slice(0, markup.indexOf('<nav'))
    const tags = [...ancestors.matchAll(/<[a-z]+ [^>]*>/g)].map((m) => m[0])

    expect(tags.length).toBeGreaterThanOrEqual(4)
    for (const tag of tags)
      expect(tag).not.toMatch(
        /\b(transform|translate-|-translate-|scale-|rotate-|filter|blur|backdrop-|will-change)/,
      )
  })

  it('바깥 header 는 fixed · z-40 이고 지도 드래그를 먹지 않는다 — 표시는 CSS 가 정한다', () => {
    const header = classList(openTag(render(authed), (open) => open.startsWith('<header')))

    for (const name of ['fixed', 'z-40', 'pointer-events-none']) expect(header.has(name)).toBe(true)
    // `display` 는 `.island-header` · `body:has(.map-island)` 규칙이 갖는다 — 유틸리티가 끼면 순서 싸움이 된다
    for (const name of ['hidden', 'block', 'flex']) expect(header.has(name)).toBe(false)
  })

  /* 띠 헤더 전용 조각이 알약에 들어오지 않는다 (D1-1) */
  it('회원가입 · 서비스 소개 · 병원 · 약국 링크가 없다', () => {
    const markup = render(authed)

    expect(markup).not.toContain('href="/signup"')
    expect(markup).not.toContain('href="/about"')
    expect(markup).not.toContain('href="/emergency"')
    expect(markup).not.toContain('회원가입')
  })

  it('메뉴와 계정 사이 세로 구분선 1 × 20 이 있다', () => {
    const divider = classList(
      openTag(render(authed), (open) => open.startsWith('<span ') && open.includes('aria-hidden')),
    )

    for (const name of ['bg-border', 'h-5', 'w-px', 'mx-1']) expect(divider.has(name)).toBe(true)
  })
})

describe('IslandHeader — 비로그인', () => {
  it('로그인은 지금 경로로 돌아오는 링크 하나다 — 채운 버튼이 아니다', () => {
    const markup = render(false, '/places')
    const login = openTag(markup, (open) => open.includes('href="/login?returnTo=%2Fplaces"'))
    const classes = classList(login)

    expect(markup.split('href="/login?returnTo=%2Fplaces"')).toHaveLength(2)
    for (const name of ['h-10', 'rounded-full', 'px-3', 'text-body-2', 'font-semibold', 'text-fg'])
      expect(classes.has(name)).toBe(true)
    expect(classes.has('bg-brand-600')).toBe(false)
    // 홈 복귀 `/login` 이 아니다
    expect(markup).not.toContain('href="/login"')
  })

  it('보호 메뉴는 로그인 우회 링크다', () => {
    const markup = render(false)

    expect(markup).toContain('href="/login?returnTo=%2Fplans"')
    expect(markup).toContain('href="/login?returnTo=%2Fai-plans%2Fnew"')
  })

  it('계정 메뉴가 없다', () => {
    expect(render(false)).not.toContain('data-account-variant')
  })
})

describe('IslandHeader — 로그인', () => {
  it('계정은 island 갈래(프로필 원)다 · 로그인 링크가 없다', () => {
    const markup = render(true)

    expect(markup).toContain('data-account-variant="island"')
    expect(markup).not.toContain('returnTo=%2Fplaces')
  })
})

/*
  `AccountMenu` 는 React Query 를 요구해 node 에서 렌더하지 않는다 — 트리거 갈래를 소스로 본다.
  island 갈래: 40 원 · `내 정보` 글자 없음 · 접근 이름 그대로.
*/
describe('AccountMenu variant="island" (D1-2)', () => {
  const source = readSourceWithoutComments('src/features/nav/account-menu.tsx')

  it('트리거가 size-10 rounded-full 이고 내 정보 글자는 header 갈래에만 있다', () => {
    const island = /variant === 'island'\s*\?\s*'([^']*)'/.exec(source)?.[1] ?? ''

    expect(island.split(/\s+/)).toEqual(expect.arrayContaining(['size-10', 'rounded-full']))
    expect(island).not.toContain('lg:w-auto')
    expect(source).toMatch(/variant === 'header' && \(\s*<span[^>]*>내 정보<\/span>/)
  })

  it('접근 이름 · 메뉴 속성은 갈래와 무관하다', () => {
    expect(source).toContain('aria-label="내 정보 메뉴 열기"')
    expect(source).toContain('aria-haspopup="menu"')
  })
})

describe('island-header.tsx — 띠 헤더 조각을 쓰지 않는다 (D3-1)', () => {
  const source = readSourceWithoutComments('src/features/nav/island-header.tsx')

  it('HeaderActions 를 쓰지 않고 로고 조각만 공유한다', () => {
    expect(source).not.toContain('HeaderActions')
    expect(source).toContain('<HeaderLogo />')
    expect(source).toContain('<NavLinks authed={authed} variant="island" />')
    expect(source).not.toContain('<Wordmark')
  })
})
