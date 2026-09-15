import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

// 자식(`NavLinks` · `PetSwitcherSlot`)이 라우터·React Query 를 요구한다. 헤더 셸만 본다
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/features/nav/pet-switcher-slot', () => ({ PetSwitcherSlot: () => null }))
vi.mock('@/features/nav/account-menu', () => ({ AccountMenu: () => null }))

const { GlobalHeader } = await import('@/features/nav/global-header')

function render(authed: boolean) {
  return renderToStaticMarkup(createElement(GlobalHeader, { authed }))
}

/*
  **모바일 미로그인 진입점** (#636 · 홈-첫방문-판정-세부명세 D1). 데스크톱 `로그인 ·
  회원가입` 쌍이 `md:flex` 라 768 미만에서는 헤더에 로그인으로 가는 길이 없었다 —
  탭바에도 없다.
*/
describe('GlobalHeader — 모바일 로그인 링크', () => {
  it('미로그인이면 모바일 전용 로그인 링크가 선다', () => {
    const markup = render(false)

    // 데스크톱 쌍(`md:flex`)과 모바일 링크(`md:hidden`) 둘이다
    expect(markup.split('href="/login"')).toHaveLength(3)
    expect(markup).toContain('md:hidden')
  })

  /*
    **44px 탭 영역이다** (D6). 텍스트 링크라 글자 높이만으로는 터치 영역이 모자란다.
    로고 링크도 `h-11` 이라 마크업 전체에서 문자열을 찾으면 통과해 버린다 — 그 `<a>` 의
    class 속성만 떼어 본다.
  */
  it('모바일 링크가 44px 탭 영역을 갖는다', () => {
    // 속성 순서는 렌더러가 정한다 — 순서를 가정하지 않고 여는 태그를 훑어 고른다
    const tag = [...render(false).matchAll(/<a [^>]*>/g)]
      .map((match) => match[0])
      .find((open) => open.includes('href="/login"') && open.includes('md:hidden'))

    expect(tag).toBeDefined()
    expect(tag).toContain('h-11')
  })

  it('로그인 상태에서는 렌더하지 않는다', () => {
    const markup = render(true)

    expect(markup).not.toContain('href="/login"')
  })
})
