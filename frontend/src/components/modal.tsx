'use client'

import { type ReactNode, type RefObject, useId, useRef } from 'react'

import { useOverlay } from '@/lib/ui/overlay'
import { cn } from '@/lib/utils/cn'

/**
 * Modal — 다이얼로그 계약 **한 벌**.
 *
 * focus trap 진입 · Esc 닫기 · 바탕 스크롤 잠금 · 포커스 복귀 · `aria-modal` 은
 * 화면마다 다시 구현할 것이 아니다. 한 군데가 빠지면 그 다이얼로그만 조용히
 * 접근성이 깨진다 — 그래서 계약을 여기 하나로 모으고 `ConfirmModal` 도 이것을 쓴다.
 *
 * **레이아웃만 소유하고 내용은 모른다.** 제목 · 설명 · 본문(children) · 조작부(footer)
 * 네 자리를 이 순서로 낸다. 확인 다이얼로그인지 입력 폼인지는 호출부가 정한다.
 *
 * 디자인 가이드 §5-2 · §6.
 */
export function Modal({
  open,
  onClose,
  title,
  /** 제목 아래 보조 설명. 주면 `aria-describedby` 로 묶는다 */
  description,
  /** 조작부. 확인/취소 같은 버튼 행을 통째로 받는다 */
  footer,
  /**
   * `alertdialog` 는 **되돌릴 수 없는 확인**에만 쓴다 — 스크린리더가 즉시 읽어
   * 사용자를 붙잡는다. 입력 폼은 `dialog` 다.
   */
  role = 'dialog',
  /**
   * DOM id 접두사. 생략하면 `useId()` 로 자동 생성한다.
   * **고정 id 가 필요한 곳만 넘긴다** (`ConfirmModal` 이 기존 id 를 지키려고 쓴다).
   */
  idBase,
  /**
   * 열릴 때 초점을 받을 요소. 생략하면 컨테이너 안 첫 초점 가능 요소다.
   * **파괴적 확인은 반드시 안전한 쪽을 지정한다** — 그렇지 않으면 Enter 한 번에 일이 벌어진다.
   */
  initialFocusRef,
  /** `sm` = 확인 다이얼로그, `md` = 입력 폼 (필드가 좁으면 오히려 읽기 어렵다) */
  size = 'sm',
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  footer?: ReactNode
  role?: 'dialog' | 'alertdialog'
  idBase?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  size?: 'sm' | 'md'
  children?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const base = idBase ?? generatedId

  // exactOptionalPropertyTypes 라 undefined 를 명시적으로 넘길 수 없다.
  // 지정하지 않으면 useOverlay 가 컨테이너 안 첫 초점 가능 요소를 잡는다
  useOverlay({
    open,
    onClose,
    containerRef: panelRef,
    ...(initialFocusRef === undefined ? {} : { initialFocusRef }),
  })

  if (!open) return null

  const titleId = `${base}-title`
  const descriptionId = `${base}-desc`

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
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        className={cn(
          'bg-bg relative w-full rounded-xl p-5 shadow-lg outline-none',
          size === 'md' ? 'max-w-md' : 'max-w-sm',
        )}
      >
        <h2 id={titleId} className="text-body-1 text-fg font-semibold">
          {title}
        </h2>

        {description !== undefined && (
          <div id={descriptionId} className="text-body-2 text-fg-muted mt-2">
            {description}
          </div>
        )}

        {children !== undefined && <div className="mt-4">{children}</div>}

        {footer !== undefined && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
