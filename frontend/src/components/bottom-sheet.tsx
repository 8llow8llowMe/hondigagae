'use client'

import { type ReactNode, useRef } from 'react'

import { useOverlay } from '@/lib/ui/overlay'
import { cn } from '@/lib/utils/cn'

/**
 * BottomSheet — 흐름을 잇는 선택 (디자인 가이드 §5-2).
 *
 * **여기서 선택 → 그 자리에서 실행.** 화면을 이동시키지 않아 담으려던 맥락을 잃지 않는다.
 * 단계가 더 필요하면 **같은 시트를 한 단계 밀어 넣는다**(좌상단 뒤로). 새 화면으로
 * 보내지 않는다. **오버레이 위에 오버레이를 쌓지 않는다.**
 *
 * **주요 버튼에 결과를 쓴다** — "적용" 이 아니라 "27곳 보기", "2일차에 담기".
 * 데스크톱에서는 시트가 아니라 좌측 레일·팝오버로 대체한다(세로 공간이 있다).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  /** 있으면 좌상단 뒤로 버튼을 그린다 — 같은 시트 안에서 단계를 되돌린다 */
  onBack,
  children,
  /** 시트 하단에 고정되는 주요 액션. 라벨에 결과를 쓴다 */
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  onBack?: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useOverlay({ open, onClose, containerRef: panelRef })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      {/* 배경 rgba(21,24,29,.5) — 가이드 §5-2.
          Esc 와 바깥 클릭이 닫기를 맡으므로 a11y 트리에서 뺀다 — 전면을 덮는 버튼이
          스크린리더에 거대한 버튼으로 읽히면 방해만 된다. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="overlay-backdrop absolute inset-0"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'bg-bg relative flex max-h-[85dvh] w-full flex-col rounded-t-xl shadow-lg outline-none md:max-w-md md:rounded-xl',
          className,
        )}
      >
        {/* 그래버 36×4 — 모바일에서만. 데스크톱 중앙 패널에는 끌 손잡이가 없다 */}
        <div aria-hidden className="flex justify-center pt-2 pb-1 md:hidden">
          <span className="bg-border-strong h-1 w-9 rounded-full" />
        </div>

        <div className="flex items-center gap-2 px-4 pt-2 pb-4">
          {onBack !== undefined && (
            <button
              type="button"
              onClick={onBack}
              aria-label="이전 단계"
              className="text-fg-muted hover:text-fg focus-visible:ring-brand-500 -ml-2 flex size-11 items-center justify-center focus-visible:ring-2 focus-visible:outline-none"
            >
              <span aria-hidden>←</span>
            </button>
          )}
          <h2 className="text-body-1 text-fg font-semibold">{title}</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer !== undefined && (
          <div className="border-border bg-bg border-t px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}
