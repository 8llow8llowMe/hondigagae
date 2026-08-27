'use client'

import { useEffect } from 'react'

/**
 * 입력 중 브라우저 이탈 경고 (`form-guide.md` §7).
 *
 * **`beforeunload` 로 브라우저 이탈만 다룬다.** App Router 내 라우트 이동은
 * 경고하지 않는다 — 이동을 가로채는 공식 API 가 없다
 * (회원가입-세부명세.md D8-4).
 *
 * `active` 는 보통 `isDirty && !isSubmitting` 이다. **제출 중을 제외하는 것이
 * 중요하다** — 포함하면 성공 리다이렉트 직전에도 경고가 뜬다.
 */
export function useUnsavedWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [active])
}
