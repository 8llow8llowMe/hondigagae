'use client'

import { type RefObject, useEffect } from 'react'

/**
 * 오버레이 공통 동작 — 디자인 가이드 §5-2 · §6.
 *
 * 세 가지를 함께 건다. 하나라도 빠지면 접근성 계약이 깨진다.
 * - Esc 로 닫고 **트리거로 포커스를 되돌린다**
 * - 열릴 때 컨테이너 안으로 포커스를 넣는다
 * - 바탕 스크롤을 잠근다
 */
export function useOverlay({
  open,
  onClose,
  containerRef,
  /** 닫을 때 포커스를 되돌릴 대상. 없으면 열기 직전의 활성 요소로 돌아간다 */
  triggerRef,
  initialFocusRef,
  /** 팝오버는 바탕 스크롤을 잠그지 않는다 — 배경 덮개가 없어 페이지가 살아 있다 */
  lockScroll = true,
}: {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  triggerRef?: RefObject<HTMLElement | null>
  /**
   * 열릴 때 초점을 받을 요소. ConfirmModal 은 이것으로 **취소**를 잡는다 —
   * 파괴 버튼에 포커스가 가면 Enter 한 번에 되돌릴 수 없는 일이 일어난다.
   */
  initialFocusRef?: RefObject<HTMLElement | null>
  lockScroll?: boolean
}): void {
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // 첫 초점을 컨테이너 안으로. 초점 가능한 것이 없으면 컨테이너 자신이 받는다.
    const container = containerRef.current
    const focusable = container?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    ;(initialFocusRef?.current ?? focusable ?? container)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    if (lockScroll) document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (lockScroll) document.body.style.overflow = previousOverflow
      // 트리거 복귀. 이것이 없으면 닫은 뒤 포커스가 body 로 떨어진다.
      ;(triggerRef?.current ?? previouslyFocused)?.focus()
    }
  }, [open, onClose, containerRef, triggerRef, initialFocusRef, lockScroll])
}
