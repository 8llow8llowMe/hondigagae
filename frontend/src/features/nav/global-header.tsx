import Link from 'next/link'

import { EmergencyIcon } from '@/components/icons'
import { AccountMenu } from '@/features/nav/account-menu'
import { NavLinks } from '@/features/nav/nav-links'
import { PetSwitcherSlot } from '@/features/nav/pet-switcher-slot'

/**
 * 전역 헤더 — 아트보드 `01 홈`(모바일 56) / `02 홈`(데스크톱 64) / `03 전역 nav`.
 *
 * **서버 컴포넌트다.** 세션으로 분기하는 셸만 담당하고, 활성 판정(`usePathname`)과
 * 스위처 조회는 client 자식이 맡는다.
 *
 * 좌우 패딩 16(모바일) / 40(데스크톱). `max-width` 를 두지 않는다 — 헤더는 화면 폭을 쓴다.
 * 로고와 nav 사이 gap 32, nav 항목 사이 gap 4.
 *
 * **`(auth)` 그룹에는 두지 않는다** — 이탈 경로가 되면 `returnTo` 흐름이 깨진다.
 */
export function GlobalHeader({ authed }: { authed: boolean }) {
  return (
    <header className="border-border bg-bg sticky top-0 z-30 border-b">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-10">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href="/"
            className="text-fg focus-visible:ring-brand-500 text-emphasis inline-flex h-11 shrink-0 items-center rounded-md font-extrabold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
          >
            혼디가개
          </Link>
          <NavLinks authed={authed} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* 모바일 헤더의 스위처. 데스크톱은 홈 프로필 카드가 맡는다 */}
          {authed && <PetSwitcherSlot />}

          {/* 상시 진입점. 아이콘만 danger 색이고 배경을 채우지 않는다 */}
          <Link
            href="/emergency"
            aria-label="병원 · 약국"
            className="text-danger-700 hover:bg-band focus-visible:ring-brand-500 inline-flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <EmergencyIcon size={24} />
          </Link>

          {authed ? (
            <AccountMenu />
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/login"
                className="text-body-1 text-fg hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md px-3 font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="text-body-1 bg-brand-500 text-fg-inverse hover:bg-brand-600 focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md px-4 font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
