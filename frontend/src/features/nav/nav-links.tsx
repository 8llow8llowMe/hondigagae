'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { type NavItem, toLoginHref, visibleDesktopItems } from '@/features/nav/menu-items'
import { isActiveNav } from '@/lib/nav/active'
import { cn } from '@/lib/utils/cn'

/**
 * 데스크톱 헤더 메뉴 — 아트보드 `03 전역 nav · B` 그대로.
 *
 * 링크는 16/500 `--fg`, padding 8/12, radius 8. 항목 사이 gap 4.
 * 활성은 **배경 + weight 600 + `aria-current` 3중**이다 (색만으로 표시하지 않는다).
 *
 * **`내 반려견` 은 여기 없다.** nav 의 셋(장소 찾기·여행 일정·AI 일정 생성)은 *할 일*이고,
 * 내 반려견·마이페이지·로그아웃은 *내 설정*이라 우측 아바타 팝오버가 맡는다.
 * 같은 줄에 섞으면 nav 의 기준이 흐려져 항목이 계속 늘어난다.
 */
export function NavLinks({ authed }: { authed: boolean }) {
  const pathname = usePathname()

  return (
    <nav aria-label="주요" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {visibleDesktopItems(authed).map((item) => (
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
        'text-body-1 focus-visible:ring-brand-500 flex items-center gap-1.5 rounded-md px-3 py-2 focus-visible:ring-2 focus-visible:outline-none',
        active ? 'bg-band text-fg font-semibold' : 'text-fg hover:bg-band font-medium',
      )}
    >
      {item.label}
      {/* accent 는 "AI 가 생성·판단한 것" 표시 전용이다 (DESIGN.md §2-5) */}
      {item.ai === true && (
        <span className="text-caption bg-accent-100 text-accent-700 rounded-sm px-1.5 py-0.5 font-semibold">
          AI
        </span>
      )}
    </Link>
  )
}
