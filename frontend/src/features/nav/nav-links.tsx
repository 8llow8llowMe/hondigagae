'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Badge } from '@/components/badge'
import { type NavItem, toLoginHref, visibleDesktopItems } from '@/features/nav/menu-items'
import { isActiveNav } from '@/lib/nav/active'
import { cn } from '@/lib/utils/cn'

/**
 * 데스크톱 헤더 메뉴 — 전역nav-세부명세 D1 · D4.
 *
 * `usePathname()` 을 쓰므로 client 다. 헤더 셸(로고·레이아웃)은 서버에 남긴다.
 * `MobileTabBar` 와 **합치지 않는다** — 활성 판정만 같고 구성이 다르다 (D2).
 *
 * 활성 표시는 **색만이 아니라 weight + `aria-current` 3중**이다 (D6).
 */
export function NavLinks({ authed }: { authed: boolean }) {
  const pathname = usePathname()
  const items = visibleDesktopItems(authed)

  return (
    <nav aria-label="주요" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <DesktopLink item={item} active={isActiveNav(pathname, item.href)} authed={authed} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function DesktopLink({
  item,
  active,
  authed,
}: {
  item: NavItem
  active: boolean
  authed: boolean
}) {
  const href = item.protected && !authed ? toLoginHref(item.href) : item.href

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'text-body-2 focus-visible:ring-brand-500 inline-flex h-11 items-center gap-1.5 rounded-md px-3 focus-visible:ring-2 focus-visible:outline-none',
        active ? 'bg-band text-fg font-semibold' : 'text-fg-muted hover:bg-band font-medium',
      )}
    >
      {item.label}
      {/* accent 는 "AI 가 생성·판단한 것" 표시 전용이다 (DESIGN.md §2-5) */}
      {item.ai === true && (
        <Badge tone="accent" size="sm">
          AI
        </Badge>
      )}
    </Link>
  )
}
