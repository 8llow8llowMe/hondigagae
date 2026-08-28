'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

/**
 * Toast — **끝난 일을 알린다** (디자인 가이드 §5-2).
 *
 * **결과를 값으로 말한다** — "저장했어요" 가 아니라 "어느 일정 몇 일차에".
 * 액션은 최대 1개, 그 결과를 확인하는 링크만("일정 보기").
 *
 * 지켜야 하는 것 셋:
 * - **되돌리기(undo)를 토스트에 담지 않는다.** 사라지는 UI 에 유일한 복구 수단을 두지
 *   않는다. 취소가 필요한 일은 편집모드의 취소선 + 복구로 보류한다.
 * - **오류를 토스트로 말하지 않는다.** 오류는 섹션 안에 남아야 다시 시도할 수 있다
 *   (`ErrorState`).
 * - **동시에 하나만.** 새 토스트가 이전 것을 교체한다.
 *
 * 체류 4초, 액션이 있으면 6초.
 */

export type ToastPayload = {
  message: string
  /** 결과를 확인하는 링크 하나만. 되돌리기를 넣지 않는다 */
  action?: { label: string; onAction: () => void }
}

type ToastContextValue = {
  /** 이전 토스트를 교체한다 */
  showToast: (toast: ToastPayload) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (value === null) throw new Error('useToast 는 ToastProvider 안에서만 쓴다')
  return value
}

const DURATION_PLAIN_MS = 4000
const DURATION_WITH_ACTION_MS = 6000

export function ToastProvider({
  children,
  /**
   * 고정 하단 바(모바일 탭바) 위 88px. 바가 없으면 24px — 가이드 §5-2.
   * 탭바가 없는 데스크톱·인증 레이아웃에서는 `false` 로 둔다.
   */
  aboveTabBar = true,
}: {
  children: ReactNode
  aboveTabBar?: boolean
}) {
  const [toast, setToast] = useState<ToastPayload | null>(null)

  const showToast = useCallback((next: ToastPayload) => {
    // 교체 — 쌓지 않는다
    setToast(next)
  }, [])

  useEffect(() => {
    if (toast === null) return
    const ms = toast.action === undefined ? DURATION_PLAIN_MS : DURATION_WITH_ACTION_MS
    const timer = window.setTimeout(() => setToast(null), ms)
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* role="status" — 끝난 일의 알림이라 alert 가 아니다.
          컨테이너를 항상 렌더해야 내용이 채워질 때 스크린리더가 읽는다. */}
      <div
        role="status"
        aria-live="polite"
        className={
          aboveTabBar
            ? 'pointer-events-none fixed inset-x-4 bottom-22 z-50 md:bottom-6'
            : 'pointer-events-none fixed inset-x-4 bottom-6 z-50'
        }
      >
        {toast !== null && (
          <div className="bg-fg text-fg-inverse pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-4 rounded-md px-4 py-3 shadow-lg">
            <span className="text-body-2">{toast.message}</span>
            {toast.action !== undefined && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onAction()
                  setToast(null)
                }}
                className="text-body-2 shrink-0 font-semibold underline focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
