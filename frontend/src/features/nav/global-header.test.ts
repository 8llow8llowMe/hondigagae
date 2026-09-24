import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { openingTags, readSourceWithoutComments } from '@/test/source'

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

/*
  **계정 메뉴 트리거의 누르는 자리 44** (#905 R3). `AccountMenu` 는 라우터·상태를 요구해
  여기서 렌더하지 않고(위 `vi.mock`) 소스의 트리거 태그를 본다. 헤더가 `md:h-16`(64) 이고
  트리거는 `hidden md:block` 이라 44 가 헤더 안에 든다.
*/
describe('AccountMenu — 트리거 크기 (#905 R3)', () => {
  it('트리거가 size-11 이다 — size-9(36) 로 돌아가지 않는다', () => {
    const source = readSourceWithoutComments('src/features/nav/account-menu.tsx')
    const trigger = openingTags(source, /<button\b/g).find((tag) =>
      tag.includes('aria-haspopup="menu"'),
    )

    expect(trigger).toBeDefined()
    expect(trigger).toContain('size-11')
    expect(trigger).not.toContain('size-9')
  })
})
