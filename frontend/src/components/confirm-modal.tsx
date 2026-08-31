'use client'

import { type ReactNode, useRef } from 'react'

import { Button } from '@/components/button'
import { Modal } from '@/components/modal'

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
 *
 * 다이얼로그 계약(focus trap · Esc · 스크롤 잠금 · 포커스 복귀 · `aria-modal`)은
 * `Modal` 이 갖는다. 여기는 **확인 다이얼로그의 규칙**만 남긴다.
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
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      // 되돌릴 수 없는 확인이라 alertdialog 다 — 스크린리더가 즉시 읽어 사용자를 붙잡는다
      role="alertdialog"
      // 기존 DOM id 를 지킨다. 이 모달은 한 번에 하나만 뜨므로 고정이어도 충돌하지 않는다
      idBase="confirm"
      initialFocusRef={cancelRef}
      footer={
        // 취소가 좌측 — 가이드 §5-2
        <>
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
        </>
      }
    >
      {children}
    </Modal>
  )
}
