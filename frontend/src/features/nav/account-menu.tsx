'use client'

import { useRef, useState } from 'react'

import { MyPageIcon } from '@/components/icons'
import { Menu, MenuAnchor, type MenuItem } from '@/components/menu'
import { ACCOUNT_MENU_ITEMS } from '@/features/nav/menu-items'

/**
 * 우측 아바타 = 계정 메뉴 — 아트보드 `03 전역 nav · B`.
 *
 * nav 의 셋(장소 찾기 · 여행 일정 · AI 일정 생성)은 **할 일**이고, 내 반려견 · 마이페이지 ·
 * 로그아웃은 **내 설정**이다. 같은 줄에 섞으면 nav 의 기준이 흐려져 항목이 계속 늘어난다.
 * 모바일의 "내 정보 탭 안" 과 같은 구조다 — 두 폭이 다른 IA 를 갖지 않는다.
 *
 * **반려견 전환은 여기가 아니다.** 판정 기준을 바꾸는 동작은 홈의 `ProfileCard` 가 맡는다.
 *
 * 아바타 36 원형 `--band`. 팝오버는 radius 12 + `--shadow-md` — 떠 있는 것의 예외다.
 *
 * 오버레이 배선(focus trap · Esc · 바깥 클릭 · 포커스 복귀)은 **`Menu` 가 소유한다.**
 * 예전에는 여기서 `useOverlay` 부터 패널 마크업까지 다시 만들고 있었다 — `MenuItem` 이
 * `href` 를 받지 못해서였고, 그것을 컴포넌트 쪽에서 고쳤다 (이슈 #70).
 */
const ITEMS: MenuItem[] = [
  ...ACCOUNT_MENU_ITEMS.map((item) => ({ href: item.href, label: item.label })),
  // 파괴적 항목은 마지막 (가이드 §5-2 Popover)
  { href: '/logout', label: '로그아웃', destructive: true },
]

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <MenuAnchor className="hidden md:block">
      <button
        ref={triggerRef}
        type="button"
        aria-label="내 정보 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="bg-band text-fg-muted focus-visible:ring-brand-500 flex size-9 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <MyPageIcon size={20} />
      </button>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        items={ITEMS}
        label="내 정보"
        className="end-0 mt-1"
      />
    </MenuAnchor>
  )
}
