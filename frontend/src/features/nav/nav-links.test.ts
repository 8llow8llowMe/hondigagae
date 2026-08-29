import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

// usePathname 은 라우터 컨텍스트를 요구한다. node 환경에서는 경로만 주면 충분하다
const pathname = { current: '/' }
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

const { NavLinks } = await import('@/features/nav/nav-links')
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
  it('보호 메뉴 3개를 숨긴다', () => {
    const markup = renderNav(false)

    expect(markup).not.toContain('여행 일정')
    expect(markup).not.toContain('AI 일정 생성')
    expect(markup).not.toContain('내 반려견')
  })

  it('공개 메뉴는 남는다 — 미로그인도 장소는 볼 수 있다', () => {
    expect(renderNav(false)).toContain('장소 찾기')
  })

  it('로그인하면 보호 메뉴가 보인다', () => {
    const markup = renderNav(true)

    expect(markup).toContain('여행 일정')
    expect(markup).toContain('AI 일정 생성')
    expect(markup).toContain('내 반려견')
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
