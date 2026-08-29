'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { HomeIcon, MyPageIcon, PlaceIcon, PlanIcon } from '@/components/icons'
import { MOBILE_TAB_ITEMS, toLoginHref } from '@/features/nav/menu-items'
import { isActiveNav } from '@/lib/nav/active'
import { cn } from '@/lib/utils/cn'

/**
 * 모바일 하단 탭바 — 전역nav-세부명세 D1 · D4.
 *
 * **미로그인이어도 탭 4개를 유지한다** (D4-2). 탭은 위치가 근육기억이라 숨기면 남은 탭이
 * 이동해 오조작이 늘어난다. 대신 보호 탭은 `returnTo` 를 붙여 로그인으로 보낸다.
 *
 * **태블릿(768+)에는 두지 않는다** (D8-2) — 헤더와 탭바가 같이 보이면 같은 목적지가
 * 두 곳에 있어 어디를 눌러야 할지 모른다.
 *
 * `position: fixed` 이므로 본문에 탭바 높이만큼 `padding-bottom` 을 준다 (layout).
 */
const ICONS = [HomeIcon, PlaceIcon, PlanIcon, MyPageIcon] as const

export function MobileTabBar({ authed }: { authed: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="하단"
      className="border-border bg-bg fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {MOBILE_TAB_ITEMS.map((item, index) => {
          const active = isActiveNav(pathname, item.href)
          const Icon = ICONS[index] ?? HomeIcon
          const href = item.protected && !authed ? toLoginHref(item.href) : item.href

          return (
            <li key={item.href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                // 각 칸 최소 44px — DESIGN.md §7
                className={cn(
                  'focus-visible:ring-brand-500 flex h-16 flex-col items-center justify-center gap-1 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
                  active ? 'text-fg font-semibold' : 'text-fg-muted font-medium',
                )}
              >
                <Icon size={24} />
                {/* 아이콘만 두지 않는다 — 아이콘 + 텍스트를 함께 (D6) */}
                <span className="text-caption">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
