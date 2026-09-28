'use client'

import { usePathname } from 'next/navigation'

import { ButtonLink } from '@/components/button'
import { HEADER_ABOUT_LINK } from '@/features/nav/menu-items'
import { isActiveNav } from '@/lib/nav/active'

/**
 * 헤더 오른쪽 묶음의 `서비스 소개` — 전역nav-세부명세 D4-5 (#964).
 *
 * **client 인 이유는 활성 판정 하나다.** `GlobalHeader` 는 서버 컴포넌트라 경로를 모른다 —
 * `NavLinks` 와 같은 방식으로 `usePathname` + `isActiveNav` 를 client 자식이 맡는다.
 *
 * **외형은 같은 줄의 `로그인` 과 같다** — `ButtonLink` `ghost` · `md`(누르는 자리 44).
 * 조용한 텍스트 링크로 두고 새 색 · 면을 얹지 않는다. `/about` 에서는 `aria-current="page"`
 * 만 붙는다 — 활성 배경은 nav 항목의 표시라 nav 밖 안내 링크에 옮기지 않는다.
 *
 * **`hidden lg:inline-flex`** — 1024 미만에는 서지 않는다. 표시(display)만 바꾸는
 * 레이아웃 유틸리티라 `className` 규약 안이다 (`component-guide.md` §3, `home-view` 의
 * `hidden md:inline-flex` 와 같은 쓰임). 로그인 조건은 부르는 쪽(`GlobalHeader`)이 건다.
 */
export function HeaderAboutLink() {
  const pathname = usePathname()
  const active = isActiveNav(pathname, HEADER_ABOUT_LINK.href)

  return (
    <ButtonLink
      href={HEADER_ABOUT_LINK.href}
      variant="ghost"
      className="hidden lg:inline-flex"
      aria-current={active ? 'page' : undefined}
    >
      {HEADER_ABOUT_LINK.label}
    </ButtonLink>
  )
}
