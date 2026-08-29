'use client'

import { type ReactNode, useRef } from 'react'

import { Button } from '@/components/button'
import { useOverlay } from '@/lib/ui/overlay'

/**
 * ConfirmModal — **되돌릴 수 없는 일만** (디자인 가이드 §5-2).
 *
 * 선택이 아니라 확인이므로 화면을 잡아두는 것이 맞다.
 * **되돌릴 수 있는 일에는 모달을 쓰지 않는다.**
 *
 * **영향 범위를 개수로 센다** — "초코가 들어간 일정 1개는 그대로 남지만, 판정은 다시
 * 계산돼요". 세지 못하면 **그 값을 먼저 구한다.** 구할 수 없으면 셀 수 있는 것만 말하고
 * **셀 수 없는 것을 숫자로 적지 않는다** — 틀린 개수는 없는 개수보다 나쁘다.
 *
 * 취소가 좌측이고 **기본 포커스는 취소**다 — 파괴 버튼에 포커스를 두면 Enter 한 번에
 * 되돌릴 수 없는 일이 일어난다.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  /** 영향 범위를 개수로 적는다 */
  description,
  confirmLabel,
  cancelLabel = '취소',
  /** 파괴적인 확인이면 danger 채움 버튼을 쓴다 */
  destructive = false,
  /** 확인 버튼을 잠글 때 (예: "탈퇴" 타이핑 확인 미완료) */
  confirmDisabled = false,
  /** 요청 진행 중. 잠그는 것과 다르다 — 이쪽은 "누른 것이 처리되고 있다" 를 말한다 */
  confirmLoading = false,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  /** 동사로 쓴다 — "확인" 이 아니라 "삭제" */
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  confirmDisabled?: boolean
  confirmLoading?: boolean
  /** 추가 확인 입력(예: "탈퇴" 타이핑) */
  children?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useOverlay({ open, onClose, containerRef: panelRef, initialFocusRef: cancelRef })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-8 md:items-center md:pt-0">
      {/* 배경 덮개. Esc 와 바깥 클릭이 닫기를 맡으므로 a11y 트리에서 뺀다 —
          전면을 덮는 버튼이 스크린리더에 거대한 버튼으로 읽히면 방해만 된다. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="overlay-backdrop absolute inset-0"
      />

      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        tabIndex={-1}
        className="bg-bg relative w-full max-w-sm rounded-xl p-5 shadow-lg outline-none"
      >
        <h2 id="confirm-title" className="text-body-1 text-fg font-semibold">
          {title}
        </h2>
        <div id="confirm-desc" className="text-body-2 text-fg-muted mt-2">
          {description}
        </div>

        {children !== undefined && <div className="mt-4">{children}</div>}

        {/* 취소가 좌측 — 가이드 §5-2 */}
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={confirmDisabled}
            loading={confirmLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
