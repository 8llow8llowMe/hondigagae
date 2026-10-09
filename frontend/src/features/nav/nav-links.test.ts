import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

// usePathname 은 라우터 컨텍스트를 요구한다. node 환경에서는 경로만 주면 충분하다
const pathname = { current: '/' }
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

const { NavLinks } = await import('@/features/nav/nav-links')
const { DESKTOP_NAV_ITEMS } = await import('@/features/nav/menu-items')
const { MobileTabBar } = await import('@/features/nav/mobile-tab-bar')

function renderNav(authed: boolean, path = '/') {
  pathname.current = path
  return renderToStaticMarkup(createElement(NavLinks, { authed }))
}

function renderTabs(authed: boolean, path = '/') {
  pathname.current = path
  return renderToStaticMarkup(createElement(MobileTabBar, { authed }))
}

describe('NavLinks — 미로그인 데스크톱 (명세 D7 #1)', () => {
  /*
    **아트보드는 숨기기를 지정했고 그것을 의도적으로 벗어났다** (이슈 #116).
    숨기면 미로그인 헤더에 `장소 찾기` 하나만 남고, AI 일정 생성으로 가는 링크가
    저장소 전체에서 그 하나와 `/plans` 안의 시트뿐이라 처음 방문한 사람이 이 서비스의
    차별점을 알 방법이 없어진다. 되돌리려면 명세 D4-2 부터 고쳐야 한다.
  */
  it('보호 메뉴도 그린다 — 숨기지 않는다', () => {
    const markup = renderNav(false)

    expect(markup).toContain('여행 일정')
    expect(markup).toContain('AI 일정 생성')
  })

  it('보호 메뉴는 returnTo 를 붙여 로그인으로 보낸다 — 모바일 탭과 같은 처리다', () => {
    const markup = renderNav(false)

    expect(markup).toContain('/login?returnTo=%2Fplans')
    expect(markup).toContain('/login?returnTo=%2Fai-plans%2Fnew')
  })

  it('공개 메뉴는 로그인 없이 목적지로 바로 간다', () => {
    const markup = renderNav(false)

    expect(markup).toContain('href="/places"')
  })

  it('로그인하면 보호 메뉴가 목적지로 바로 간다', () => {
    const markup = renderNav(true)

    expect(markup).toContain('href="/plans"')
    expect(markup).toContain('href="/ai-plans/new"')
    expect(markup).not.toContain('returnTo')
  })

  it('서비스 소개를 nav 에 두지 않는다 — 소개는 할 일이 아니라 안내다 (#964)', () => {
    // 헤더 오른쪽 묶음의 "nav 밖 안내 링크" 가 맡는다 (`HeaderAboutLink`)
    expect(DESKTOP_NAV_ITEMS.some((item) => item.href === '/about')).toBe(false)
    expect(renderNav(false, '/about')).not.toContain('href="/about"')
  })

  it('내 반려견을 nav 에 두지 않는다 — 그것은 "내 설정" 이라 계정 팝오버가 맡는다', () => {
    // nav 의 셋은 "할 일" 이다. 같은 줄에 설정을 섞으면 항목이 계속 늘어난다 (아트보드 03-B)
    expect(renderNav(true)).not.toContain('내 반려견')
  })
})

describe('MobileTabBar — 미로그인 모바일 (명세 D7 #2)', () => {
  it('탭 4개를 모두 유지한다 — 숨기면 남은 탭이 이동해 오조작이 는다', () => {
    const markup = renderTabs(false)

    expect(markup).toContain('홈')
    expect(markup).toContain('장소')
    expect(markup).toContain('일정')
    expect(markup).toContain('내 정보')
  })

  it('보호 탭은 returnTo 를 붙여 로그인으로 보낸다', () => {
    const markup = renderTabs(false)

    expect(markup).toContain('/login?returnTo=%2Fplans')
    expect(markup).toContain('/login?returnTo=%2Fmypage')
  })

  it('로그인하면 보호 탭이 목적지로 바로 간다', () => {
    const markup = renderTabs(true)

    expect(markup).toContain('href="/plans"')
    expect(markup).not.toContain('returnTo')
  })

  it('아이콘만 두지 않는다 — 라벨을 함께 그린다 (D6)', () => {
    const markup = renderTabs(true)

    expect(markup).toContain('<svg')
    expect(markup).toContain('내 정보')
  })
})

describe('활성 표시 (명세 D7 #7)', () => {
  it('/places 에서 장소 찾기에 aria-current 가 붙는다', () => {
    const markup = renderNav(true, '/places')

    expect(markup).toContain('aria-current="page"')
  })

  it('상세 화면에서도 목록 메뉴가 활성이다', () => {
    expect(renderNav(true, '/places/123')).toContain('aria-current="page"')
  })

  it('색만으로 표시하지 않는다 — weight 를 함께 올린다 (D6)', () => {
    expect(renderNav(true, '/places')).toContain('font-semibold')
  })

  it('홈이 아닌 화면에서 홈 탭이 활성이 아니다 — startsWith 로 하면 전부 걸린다', () => {
    const markup = renderTabs(true, '/places')
    // 첫 번째 <li> 가 홈 탭이다. 라벨 텍스트로 자르면 다음 앵커의 여는 태그까지 딸려온다
    const homeTab = markup.slice(0, markup.indexOf('</li>'))

    expect(homeTab).toContain('href="/"')
    expect(homeTab).not.toContain('aria-current="page"')
    // 활성인 탭은 따로 있다
    expect(markup).toContain('aria-current="page"')
  })
})

describe('랜드마크 (명세 D7 #8)', () => {
  it('메뉴는 nav[aria-label=주요] 다', () => {
    expect(renderNav(true)).toContain('aria-label="주요"')
  })

  it('탭바는 nav[aria-label=하단] 이다', () => {
    expect(renderTabs(true)).toContain('aria-label="하단"')
  })
})

/**
 * 지도 아일랜드 알약 갈래 — #1300 (`지도-아일랜드알약-정리-세부명세.md` D3-1 · D7-4).
 *
 * **띠 헤더 갈래는 한 글자도 바뀌지 않는다** — 기본 `variant` 의 마크업을 #1300 전 그대로 잠근다. 알약 갈래는 펼친
 * 칩 셋과 `≡` 갈래를 함께 그리고 컨테이너 쿼리(`app/globals.css`)가 하나만 세운다.
 */
describe('NavLinks — 띠 헤더 갈래 무변화 (#1300)', () => {
  it('기본 variant 의 링크 여는 태그가 예전 그대로다', () => {
    const markup = renderNav(true, '/places')

    expect(markup).toContain(
      '<nav aria-label="주요" class="hidden md:block"><ul class="flex items-center gap-1">',
    )
    expect(markup).toContain(
      '<a aria-current="page" class="text-body-1 focus-visible:ring-brand-500 flex items-center gap-1.5 rounded-md px-3 py-2 focus-visible:ring-2 focus-visible:outline-none bg-band text-fg font-semibold" href="/places">',
    )
    expect(markup).not.toContain('island-menu')
    expect(markup).not.toContain('메뉴 열기')
  })
})

describe('NavLinks — 알약 갈래 (#1300)', () => {
  function renderIsland(authed: boolean, path = '/places') {
    pathname.current = path
    return renderToStaticMarkup(createElement(NavLinks, { authed, variant: 'island' }))
  }

  it('≡ 버튼이 메뉴를 연다고 말한다 — aria-haspopup · aria-expanded · 이름 메뉴 열기', () => {
    const trigger = /<button[^>]*>/.exec(renderIsland(false))?.[0] ?? ''

    expect(trigger).toContain('aria-haspopup="menu"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).toContain('aria-label="메뉴 열기"')
    expect(trigger).toMatch(/class="[^"]*\bsize-10\b[^"]*\brounded-full\b/)
  })

  it('펼친 칩 목록 · 접힌 갈래에 컨테이너 쿼리 훅이 있다 — 표시는 CSS 가 정한다', () => {
    const markup = renderIsland(false)
    const list = /<ul[^>]*>/.exec(markup)?.[0] ?? ''

    expect(list).toContain('island-menu-full')
    expect(markup).toMatch(/<div class="island-menu-collapsed">/)
    // 알약은 768 이상에만 선다 — nav 자신이 폭으로 숨지 않는다
    expect(/<nav[^>]*>/.exec(markup)?.[0]).not.toContain('hidden')
  })

  it('보호 항목은 비로그인이면 로그인 우회다 — 띠 갈래와 같은 판정', () => {
    const markup = renderIsland(false)

    expect(markup).toContain('/login?returnTo=%2Fplans')
    expect(markup).toContain('/login?returnTo=%2Fai-plans%2Fnew')
  })
})
