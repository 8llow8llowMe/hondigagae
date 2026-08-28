'use client'

import { type ReactNode, useEffect, useRef } from 'react'

import { useOverlay } from '@/lib/ui/overlay'
import { cn } from '@/lib/utils/cn'

/**
 * Popover / Menu — **데스크톱의 짧은 분기** (디자인 가이드 §5-2).
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

export type MenuItem = {
  label: string
  onSelect: () => void
  /** 파괴적 항목. 목록의 마지막에 둔다 */
  destructive?: boolean
  disabled?: boolean
}

export function Menu({
  open,
  onClose,
  /** 트리거. 닫을 때 포커스가 여기로 돌아간다. `aria-expanded` 는 사용처가 건다 */
  triggerRef,
  items,
  /** 접근성 이름. 트리거 라벨과 같은 뜻으로 쓴다 */
  label,
  className,
}: {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement | null>
  items: MenuItem[]
  label: string
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
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className={cn(
            // 각 항목 44px — 가이드 §5-2
            'text-body-2 flex h-11 w-full items-center px-4 text-left font-medium',
            'hover:bg-band focus-visible:bg-band focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            item.destructive === true ? 'text-danger-900' : 'text-fg',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * 메뉴를 감싸 위치를 잡는 래퍼. `relative` 컨테이너가 없으면 팝오버가 페이지 좌상단에 뜬다.
 */
export function MenuAnchor({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative', className)}>{children}</div>
}
