import Link from 'next/link'

import { EmergencyIcon, MyPageIcon } from '@/components/icons'
import { NavLinks } from '@/features/nav/nav-links'
import { PetSwitcherSlot } from '@/features/nav/pet-switcher-slot'

/**
 * 전역 헤더 — 전역nav-세부명세 D1 · D2.
 *
 * **서버 컴포넌트다.** 세션으로 분기하는 셸만 담당하고, 활성 판정(`usePathname`)과
 * 스위처 조회는 client 자식이 맡는다.
 *
 * 높이는 모바일 56 / 데스크톱 64. `max-width` 를 두지 않고 좌우 패딩만 둔다 —
 * 헤더는 화면 폭을 쓴다.
 *
 * **`(auth)` 그룹에는 두지 않는다** — 이탈 경로가 되면 `returnTo` 흐름이 깨진다 (D0).
 */
export function GlobalHeader({ authed }: { authed: boolean }) {
  return (
    <header className="border-border bg-bg sticky top-0 z-30 border-b">
      <div className="flex h-14 items-center gap-3 px-4 md:h-16 md:px-10">
        <Link
          href="/"
          // 44px — 모바일 최소 터치 영역 (DESIGN.md §7). 로고는 홈으로 가는 주요 타깃이다
          className="text-title-2 text-fg focus-visible:ring-brand-500 inline-flex h-11 shrink-0 items-center rounded-md font-bold focus-visible:ring-2 focus-visible:outline-none"
        >
          혼디가개
        </Link>

        <NavLinks authed={authed} />

        <div className="ms-auto flex items-center gap-1">
          {authed && <PetSwitcherSlot />}

          {/* 상시 진입점. 아이콘만 danger 색이고 배경을 채우지 않는다 (D4-4) */}
          <Link
            href="/emergency"
            aria-label="주변 동물병원 찾기"
            className="text-danger-500 hover:bg-band focus-visible:ring-brand-500 inline-flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <EmergencyIcon size={24} />
          </Link>

          {authed ? (
            <Link
              href="/mypage"
              aria-label="내 정보"
              className="text-fg-muted hover:bg-band focus-visible:ring-brand-500 hidden size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none md:inline-flex"
            >
              <MyPageIcon size={24} />
            </Link>
          ) : (
            // 미로그인 데스크톱: 보호 메뉴를 숨기는 대신 진입 버튼을 준다 (D4-2)
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/login"
                className="text-body-2 text-fg-muted hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md px-3 font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="text-body-2 bg-brand-500 text-fg-inverse hover:bg-brand-600 focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-md px-4 font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
