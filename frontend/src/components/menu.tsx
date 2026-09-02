'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import Link from 'next/link'

import { useOverlay } from '@/lib/ui/overlay'
import { cn } from '@/lib/utils/cn'

/**
 * Popover / Menu — **데스크톱의 짧은 분기** (디자인 가이드 §5-2).
 *
 * 정렬은 `align` 이 정하고 **기본은 왼쪽**이다 — 목록은 왼쪽 축으로 훑는 것이 빠르다.
 * 가운데(`center`)는 **트리거가 축을 잡아 주지 못하는 자리**의 선택이다: 헤더 우측
 * 아바타처럼 아이콘 하나에서 떨어져 나온 좁은 패널은, 항목 글자보다 폭이 넓어서 왼쪽
 * 정렬이 "글자가 한쪽으로 밀린 것" 처럼 읽힌다. 화면 안의 컨트롤에 붙은 메뉴
 * (일정 관리 등)는 앞뒤 내용이 이미 왼쪽 축을 갖고 있으므로 기본값을 쓴다.
 *
 * **모바일에서는 팝오버를 쓰지 않는다** — 같은 항목을 `BottomSheet` 로 낸다.
 * 사용처가 `md:` 분기로 둘을 갈라 쓴다.
 *
 * **항목 3–5개.** 6개를 넘으면 시트나 페이지다.
 * 파괴적 항목은 **마지막**에 두고 `--danger-900` 을 쓴다.
 *
 * 배경 덮개가 없다 — 바깥 클릭으로 닫히고 페이지는 살아 있다. 그래서 바탕 스크롤도
 * 잠그지 않는다.
 */

/**
 * 항목은 **이동이거나 동작이다.** 둘 다 아니거나 둘 다인 항목은 없다.
 *
 * `href` 를 받지 않던 시절 `account-menu.tsx` 가 오버레이 배선(`useOverlay` · 바깥 클릭 ·
 * 패널 마크업)을 통째로 다시 만들었다 — 계정 메뉴 3항목이 전부 이동이기 때문이다.
 * 이동을 `onSelect` + `router.push` 로 흉내내면 새 탭·가운데클릭·주소 복사가 죽는다.
 */
type MenuItemBase = {
  label: string
  /** 파괴적 항목. 목록의 마지막에 둔다 */
  destructive?: boolean
  disabled?: boolean
}

export type MenuItem = MenuItemBase &
  ({ href: string; onSelect?: never } | { href?: never; onSelect: () => void })

export function Menu({
  open,
  onClose,
  /** 트리거. 닫을 때 포커스가 여기로 돌아간다. `aria-expanded` 는 사용처가 건다 */
  triggerRef,
  items,
  /** 접근성 이름. 트리거 라벨과 같은 뜻으로 쓴다 */
  label,
  /** 항목 정렬. 기본은 왼쪽 — 언제 가운데를 쓰는지는 위 컴포넌트 주석 */
  align = 'start',
  className,
}: {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement | null>
  items: MenuItem[]
  label: string
  align?: 'start' | 'center'
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlay({ open, onClose, containerRef: panelRef, triggerRef, lockScroll: false })

  // 바깥 클릭으로 닫는다. 덮개가 없으므로 문서에서 직접 듣는다.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) === true) return
      if (triggerRef.current?.contains(target) === true) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onClose, triggerRef])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      className={cn(
        'bg-bg border-border absolute z-40 min-w-44 rounded-lg border py-1 shadow-md outline-none',
        className,
      )}
    >
      {items.map((item) => {
        const itemClass = cn(
          // 각 항목 44px — 가이드 §5-2. 좌우 인셋은 **20**(스케일 값)이다
          'text-body-2 flex h-11 w-full items-center px-5 font-medium',
          align === 'center' ? 'justify-center text-center' : 'text-left',
          'hover:bg-band focus-visible:bg-band focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // 파괴적 항목은 마지막 + danger-900 (가이드 §5-2)
          item.destructive === true ? 'text-danger-900' : 'text-fg',
          // 파괴적 항목 위에 선을 그어 손이 미끄러지는 것을 막는다
          item.destructive === true && 'border-border mt-1 border-t',
        )

        // 이동은 `<a>` 여야 새 탭·주소 복사·스크린리더 안내가 성립한다
        if (item.href !== undefined) {
          return (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              onClick={onClose}
              className={itemClass}
            >
              {item.label}
            </Link>
          )
        }

        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
            className={itemClass}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 메뉴를 감싸 위치를 잡는 래퍼. `relative` 컨테이너가 없으면 팝오버가 페이지 좌상단에 뜬다.
 */
export function MenuAnchor({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative', className)}>{children}</div>
}
