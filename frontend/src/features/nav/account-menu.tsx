'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { MyPageIcon } from '@/components/icons'
import { ACCOUNT_MENU_ITEMS } from '@/features/nav/menu-items'
import { useOverlay } from '@/lib/ui/overlay'

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
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useOverlay({
    open,
    onClose: () => setOpen(false),
    containerRef: panelRef,
    triggerRef,
    lockScroll: false,
  })

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) === true) return
      if (triggerRef.current?.contains(target) === true) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className="relative hidden md:block">
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

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="내 정보"
          className="bg-bg border-border absolute end-0 z-40 mt-1 min-w-44 rounded-lg border py-1 shadow-md outline-none"
        >
          {ACCOUNT_MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="text-body-2 text-fg hover:bg-band flex h-11 items-center px-4 font-medium"
            >
              {item.label}
            </Link>
          ))}
          {/* 파괴적 항목은 마지막 + danger-900 (가이드 §5-2 Popover) */}
          <Link
            href="/logout"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="text-body-2 text-danger-900 hover:bg-band border-border mt-1 flex h-11 items-center border-t px-4 font-medium"
          >
            로그아웃
          </Link>
        </div>
      )}
    </div>
  )
}
