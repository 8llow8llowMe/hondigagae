'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { MyPageIcon } from '@/components/icons'
import { Menu, MenuAnchor, type MenuItem } from '@/components/menu'
import { ACCOUNT_MENU_ITEMS } from '@/features/nav/menu-items'
import { logout } from '@/lib/api/auth'
import { messages } from '@/lib/messages'

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
export function AccountMenu() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  /**
   * **`/logout` 라우트가 아니다.** 링크로 두었더니 그런 화면이 없어 404 가 떴다 —
   * 로그아웃은 이동이 아니라 동작이고, 목적지는 그 동작의 결과일 뿐이다.
   *
   * `useSessionExit` 을 쓰지 않는다. 그쪽은 **로그인 화면이 이유를 안내해야 하는 이탈**
   * (비밀번호 변경 · 탈퇴)용이라 `/login` 으로 보내는데, 스스로 나가는 로그아웃에는
   * 안내할 이유가 없다. 홈은 미로그인에도 성립하는 화면이라 그대로 보낼 수 있다.
   *
   * `queryClient.clear()` 가 필수다. 남겨 두면 다음 로그인 계정이 **이전 사용자의 캐시**를
   * 잠시 본다 — 개인정보 유출이다.
   *
   * `replace` 를 쓴다. 뒤로가기로 방금 떠난 보호 화면에 되돌아가지 않게 한다.
   * `refresh` 는 서버 컴포넌트가 들고 있는 세션 상태(전역 nav 등)까지 다시 그린다.
   */
  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      // 서버 호출이 실패해도 화면을 로그인 상태로 남겨 두지 않는다. 사용자는 이미
      // 나가겠다고 말했고, 세션 쿠키는 BFF 가 응답과 무관하게 만료시킨다.
      queryClient.clear()
      router.replace('/')
      router.refresh()
      setLoggingOut(false)
    }
  }

  const items: MenuItem[] = [
    ...ACCOUNT_MENU_ITEMS.map((item) => ({ href: item.href, label: item.label })),
    // 파괴적 항목은 마지막 (가이드 §5-2)
    {
      label: messages.member.logout,
      destructive: true,
      disabled: loggingOut,
      onSelect: () => void handleLogout(),
    },
  ]

  return (
    <MenuAnchor className="hidden md:block">
      <button
        ref={triggerRef}
        type="button"
        aria-label="내 정보 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="bg-band text-fg-muted focus-visible:ring-brand-500 flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <MyPageIcon size={20} />
      </button>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        items={items}
        label="내 정보"
        /*
          **가운데 정렬이다.** 트리거가 아바타 아이콘 하나라 패널이 이어받을 왼쪽 축이
          없고, 항목 넷이 전부 짧아 왼쪽 정렬에서는 글자 뒤로 빈 폭이 길게 남는다.
          바로 옆 반려견 스위처와 같은 규칙이다 (`Menu` 의 `align` 주석).
        */
        align="center"
        className="end-0 mt-1"
      />
    </MenuAnchor>
  )
}
