'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { HomeIcon, MyPageIcon, PlanIcon, SearchIcon } from '@/components/icons'
import { MOBILE_TAB_ITEMS, toLoginHref } from '@/features/nav/menu-items'
import { isActiveNav } from '@/lib/nav/active'
import { cn } from '@/lib/utils/cn'

/**
 * 모바일 하단 탭바 — 아트보드 `01 홈 · D` 그대로.
 *
 * 높이 64, `border-top` 1px, 4칸 grid, 각 칸 최소 44px.
 * **활성은 `--link`(`#1F7A55`) + weight 600** 이다. 비활성은 `--fg-muted` + 500.
 *
 * **미로그인이어도 탭 4개를 유지한다.** 탭은 위치가 근육기억이라 숨기면 남은 탭이
 * 이동해 오조작이 늘어난다. 대신 `returnTo` 를 붙여 로그인으로 보낸다.
 *
 * 태블릿(768+)에는 두지 않는다 — 헤더와 같이 보이면 목적지가 두 곳이 된다.
 */
const ICONS = [HomeIcon, SearchIcon, PlanIcon, MyPageIcon] as const

export function MobileTabBar({ authed }: { authed: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="하단"
      className="border-border bg-bg pb-safe fixed inset-x-0 bottom-0 z-40 h-16 border-t md:hidden"
    >
      <ul className="grid h-full grid-cols-4">
        {MOBILE_TAB_ITEMS.map((item, index) => {
          const active = isActiveNav(pathname, item.href)
          const Icon = ICONS[index] ?? HomeIcon
          const href = item.protected && !authed ? toLoginHref(item.href) : item.href

          return (
            <li key={item.href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-brand-500 flex h-full min-h-11 flex-col items-center justify-center gap-1 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
                  active ? 'text-link font-semibold' : 'text-fg-muted font-medium',
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
