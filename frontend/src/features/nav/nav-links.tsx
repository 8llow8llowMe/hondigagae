'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { MenuIcon } from '@/components/icons'
import { Menu } from '@/components/menu'
import { DESKTOP_NAV_ITEMS, type NavItem, toLoginHref } from '@/features/nav/menu-items'
import { messages } from '@/lib/messages'
import { isActiveNav } from '@/lib/nav/active'
import { cn } from '@/lib/utils/cn'

/**
 * - `header` — 띠 헤더(`GlobalHeader`). 768 미만은 숨는다(탭바가 맡는다)
 * - `island` — 지도 아일랜드 알약(#1300 D3-1). 칩이 알약과 동심원(`h-10 rounded-full`, 글자 14)이고, 알약이
 *   좁으면 메뉴 셋을 `≡` 하나로 접는다 — 두 갈래를 함께 그리고 **컨테이너 쿼리가 하나만 세운다**
 *   (`.island-menu-full` · `.island-menu-collapsed`, `app/globals.css`). 표시는 셸 CSS 가 768 이상으로 가른다
 */
type NavVariant = 'header' | 'island'

/**
 * 데스크톱 헤더 메뉴 — 아트보드 `03 전역 nav · B` 그대로.
 *
 * 링크는 16/500 `--fg`, padding 8/12, radius 8. 항목 사이 gap 4.
 * 활성은 **배경 + weight 600 + `aria-current` 3중**이다 (색만으로 표시하지 않는다).
 *
 * **`내 반려견` 은 여기 없다.** nav 의 셋(장소 찾기·여행 일정·AI 일정 생성)은 *할 일*이고,
 * 내 반려견·마이페이지·로그아웃은 *내 설정*이라 우측 아바타 팝오버가 맡는다.
 * 같은 줄에 섞으면 nav 의 기준이 흐려져 항목이 계속 늘어난다.
 *
 * **미로그인에도 셋 다 그린다** (#116). 보호 항목은 `toLoginHref` 로 우회시킨다 — 모바일
 * 탭이 이미 쓰는 방식이다. 아트보드는 숨기기를 지정했지만 그대로 두면 미로그인 헤더에
 * `장소 찾기` 하나만 남아 AI 일정 생성의 존재가 드러나지 않는다 (명세 D4-2).
 */
export function NavLinks({
  authed,
  variant = 'header',
}: {
  authed: boolean
  variant?: NavVariant
}) {
  const pathname = usePathname()
  const list = (
    <ul className={cn('flex items-center gap-1', variant === 'island' && 'island-menu-full')}>
      {DESKTOP_NAV_ITEMS.map((item) => (
        <li key={item.href}>
          <DesktopLink
            item={item}
            active={isActiveNav(pathname, item.href)}
            authed={authed}
            variant={variant}
          />
        </li>
      ))}
    </ul>
  )

  if (variant === 'header') {
    return (
      <nav aria-label="주요" className="hidden md:block">
        {list}
      </nav>
    )
  }

  return (
    <nav aria-label="주요" className="flex items-center">
      {list}
      <IslandMenuCollapsed authed={authed} pathname={pathname} />
    </nav>
  )
}

/** 보호 항목은 비로그인이면 로그인으로 우회한다 — 띠 · 알약 · `≡` 메뉴가 같은 판정을 쓴다 */
function navHref(item: NavItem, authed: boolean): string {
  return item.protected && !authed ? toLoginHref(item.href) : item.href
}

/**
 * `≡` 접힘 갈래 (#1300 D1-2) — 알약 허용 상자가 비로그인 알약 실측 폭보다 좁을 때만 선다(컨테이너 쿼리).
 * 지금 폭들에서는 서지 않는 **안전망**이다(브라우저 확대 · 글꼴 대체).
 *
 * 팝오버 배선(포커스 트랩 · Esc · 바깥 클릭 · 포커스 복귀)은 `Menu` 가 갖는다 — 다시 만들지 않는다.
 *
 * **패널은 트리거가 아니라 알약 오른쪽 끝 아래에 붙는다** — 이 갈래는 `MenuAnchor`(relative)로 감싸지 않고, 가장
 * 가까운 위치 기준 조상인 알약(`island-header.tsx` 의 `relative`)에 `end-0 top-full` 로 선다. `≡` 는 접힌 알약
 * 왼쪽에 있어서, 트리거 기준 `start-0` 이면 패널이 뷰포트 오른쪽 밖으로(1280 실측 1295), `end-0` 이면 왼쪽으로
 * 길게 나가 허용 상자 밖 미리보기 위로 넘어간다. 알약 오른쪽 끝 = 허용 상자 오른쪽 끝이라 패널이 지도 안에 남는다.
 */
function IslandMenuCollapsed({ authed, pathname }: { authed: boolean; pathname: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="island-menu-collapsed">
      <button
        ref={triggerRef}
        type="button"
        aria-label={messages.map.islandMenuOpen}
        title={messages.map.islandMenuOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="text-fg hover:bg-band focus-visible:ring-brand-500 flex size-10 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <MenuIcon size={20} />
      </button>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        items={DESKTOP_NAV_ITEMS.map((item) => ({
          href: navHref(item, authed),
          label: item.label,
          current: isActiveNav(pathname, item.href),
        }))}
        label={messages.map.islandMenuLabel}
        className="end-0 top-full mt-1"
      />
    </div>
  )
}

function DesktopLink({
  item,
  active,
  authed,
  variant,
}: {
  item: NavItem
  active: boolean
  authed: boolean
  variant: NavVariant
}) {
  const href = navHref(item, authed)

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        /*
          알약 안 칩은 **바깥과 동심원**이다(#1300 D1-1) — 알약 48 · 여백 4 · 안쪽 40 원형 · 글자 14. 띠 헤더의
          사각(8) 칩을 그대로 두면 알약 곡선과 어긋난다. 좌우 12 는 띠 헤더 값 그대로다(D1-2 — 16 이면 1280
          미리보기 열림에서 여유가 7 로 준다). 띠 헤더 갈래의 클래스 문자열은 #1300 전과 한 글자도 같다.
        */
        variant === 'island'
          ? 'text-body-2 focus-visible:ring-brand-500 flex h-10 items-center gap-1.5 rounded-full px-3 whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none'
          : 'text-body-1 focus-visible:ring-brand-500 flex items-center gap-1.5 rounded-md px-3 py-2 focus-visible:ring-2 focus-visible:outline-none',
        active ? 'bg-band text-fg font-semibold' : 'text-fg hover:bg-band font-medium',
      )}
    >
      {item.label}
      {/*
        accent 는 "AI 가 생성·판단한 것" 표시 전용이다 (DESIGN.md §2-5).

        **높이를 padding 이 아니라 `h-5` 로 말한다** — `Badge size="sm"` 과 같은 20px 이다.
        예전 `py-0.5`(2) 는 스케일 밖 값이었고(§4) 22px 이라 다른 배지들과 2px 어긋났다.
      */}
      {item.ai === true && (
        <span className="text-caption bg-accent-100 text-accent-700 inline-flex h-5 items-center rounded-sm px-1.5 font-semibold">
          AI
        </span>
      )}
    </Link>
  )
}
