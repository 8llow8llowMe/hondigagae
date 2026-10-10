import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { openingTags, readSourceWithoutComments } from '@/test/source'

// 자식(`NavLinks` · `PetSwitcherSlot`)이 라우터·React Query 를 요구한다. 헤더 셸만 본다.
// 경로는 활성 판정(`HeaderAboutLink`) 때문에 바꿀 수 있게 둔다
const pathname = { current: '/' }
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))
vi.mock('@/features/nav/pet-switcher-slot', () => ({ PetSwitcherSlot: () => null }))
vi.mock('@/features/nav/account-menu', () => ({ AccountMenu: () => null }))

const { GlobalHeader } = await import('@/features/nav/global-header')

function render(authed: boolean, path = '/') {
  pathname.current = path
  return renderToStaticMarkup(createElement(GlobalHeader, { authed }))
}

/** 마크업에서 조건에 맞는 첫 `<a>` 여는 태그. 속성 순서는 렌더러가 정해 가정하지 않는다 */
function openAnchor(markup: string, match: (open: string) => boolean) {
  return [...markup.matchAll(/<a [^>]*>/g)].map((m) => m[0]).find(match)
}

function classList(open: string | undefined) {
  return new Set(/class="([^"]*)"/.exec(open ?? '')?.[1]?.split(/\s+/) ?? [])
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

/*
  **lg 이상에서 아이콘에 글자를 붙인다** (#913). 아이콘 하나로는 "병원·약국" · "내 정보" 가
  처음 온 사람에게 읽히지 않았다. 1024 미만은 아이콘 그대로다.
*/
describe('GlobalHeader — lg 글자 라벨 (#913)', () => {
  it('응급 링크가 lg 에서 보이는 글자를 갖고, 그 글자가 aria-label 과 같다', () => {
    const markup = render(false)
    const start = markup.indexOf('href="/emergency"')
    const link = markup.slice(markup.lastIndexOf('<a', start), markup.indexOf('</a>', start))

    expect(link).toContain('aria-label="병원 · 약국"')
    expect(link).toMatch(/<span class="[^"]*hidden[^"]*lg:inline[^"]*">병원 · 약국<\/span>/)
    // 글자는 붉게 칠하지 않는다 — 아이콘만 danger 다
    expect(link).toMatch(/<span class="[^"]*text-fg[\s"]/)
    // 44 높이는 그대로, 폭은 글자만큼 자란다
    expect(link).toContain('h-11 min-w-11')
  })

  it('계정 트리거가 lg 에서 내 정보 글자를 갖고 폭만 늘린다', () => {
    const source = readSourceWithoutComments('src/features/nav/account-menu.tsx')
    const at = source.indexOf('aria-haspopup="menu"')
    const trigger = source.slice(source.lastIndexOf('<button', at), source.indexOf('</button>', at))

    expect(trigger).toContain('size-11')
    expect(trigger).toContain('lg:w-auto')
    expect(trigger).toMatch(/<span className="[^"]*hidden[^"]*lg:inline[^"]*">내 정보<\/span>/)
    expect(trigger).toContain('aria-label="내 정보 메뉴 열기"')
  })
})

/*
  **1024 이상 · 비로그인 헤더의 `서비스 소개`** (#964 · 전역nav-세부명세 D4-5). 홈 소개 카드는
  닫거나 `/about` 을 한 번 열면 다시 서지 않아, 그 뒤 데스크톱에서 `/about` 으로 가는 길이
  푸터 하나뿐이었다.
*/
describe('GlobalHeader — 서비스 소개 링크 (#964)', () => {
  const isAbout = (open: string) => open.includes('href="/about"')

  it('비로그인이면 서비스 소개 링크가 선다 — 라벨은 messages.about.title 이다', () => {
    const markup = render(false)

    expect(markup).toMatch(/<a [^>]*href="\/about"[^>]*>서비스 소개<\/a>/)
  })

  it('로그인하면 서지 않는다 — 푸터가 남는다', () => {
    expect(render(true)).not.toContain('href="/about"')
  })

  it('1024 미만에서는 숨는다 — hidden 이고 lg 에서만 선다', () => {
    const classes = classList(openAnchor(render(false), isAbout))

    expect(classes.has('hidden')).toBe(true)
    expect(classes.has('lg:inline-flex')).toBe(true)
    // 768–1023 에서 서면 헤더 여유(27px)를 넘는다
    expect(classes.has('md:inline-flex')).toBe(false)
    expect(classes.has('inline-flex')).toBe(false)
  })

  it('로그인 왼쪽에 선다 — 응급 링크 뒤, 데스크톱 로그인 앞', () => {
    const markup = render(false)
    const about = markup.indexOf('href="/about"')

    expect(about).toBeGreaterThan(markup.indexOf('href="/emergency"'))
    expect(about).toBeLessThan(markup.lastIndexOf('href="/login"'))
  })

  it('같은 줄 로그인과 같은 외형이다 — 표시 클래스만 다르고 누르는 자리 44 다', () => {
    const markup = render(false)
    const about = classList(openAnchor(markup, isAbout))
    const login = classList(
      openAnchor(markup, (open) => open.includes('href="/login"') && !open.includes('md:hidden')),
    )

    expect(about.has('h-11')).toBe(true)
    about.delete('hidden')
    about.delete('lg:inline-flex')
    login.delete('inline-flex')
    expect([...about].sort()).toEqual([...login].sort())
  })

  it('/about 에서는 aria-current="page" 가 붙는다', () => {
    expect(openAnchor(render(false, '/about'), isAbout)).toContain('aria-current="page"')
  })

  it('다른 화면에서는 aria-current 가 없다', () => {
    expect(openAnchor(render(false, '/places'), isAbout)).not.toContain('aria-current')
  })
})

/*
  **지도 아일랜드에서 걷히는 훅** (#1287). `body:has(.map-island) .global-header` 가 이 띠를 `display: none`
  으로 걷는다 — 클래스를 빠뜨리면 지도 위에 띠와 알약이 함께 선다.
*/
describe('GlobalHeader — 아일랜드 훅 클래스 (#1287)', () => {
  it('<header> 가 global-header 를 달고 띠 모양(sticky · 56/64 · border-b)은 그대로다', () => {
    const open = /<header [^>]*>/.exec(render(false))?.[0]
    const classes = classList(open)

    expect(classes.has('global-header')).toBe(true)
    for (const name of ['sticky', 'top-0', 'z-40', 'h-14', 'md:h-16', 'border-b', 'bg-bg'])
      expect(classes.has(name)).toBe(true)
  })
})
