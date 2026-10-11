'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  type CodeTimers,
  codeTimerSeconds,
  coolDownFor,
  NO_CODE_TIMERS,
  RESEND_COOLDOWN_FALLBACK_SECONDS,
  startCodeTimers,
} from '@/lib/form/code-timers'
import type { VerificationCodeSendResponse } from '@/types/auth'

export type UseCodeTimersReturn = {
  /** 다시 보낼 수 있을 때까지 남은 초. 0 이면 보낼 수 있다 */
  cooldownSeconds: number
  /** 코드 만료까지 남은 초. 지났으면 0, 받은 코드가 없으면 null */
  expiresInSeconds: number | null
  /** 발송 성공(최초 · 재발송) — 응답 값으로 두 시계를 새로 건다 */
  start: (info: VerificationCodeSendResponse) => void
  /** 다시 보내지 못했다(429). `Retry-After` 초를 넘기고, 없으면(null) 대체값 60초다 */
  coolDown: (seconds: number | null) => void
  /** 이메일을 다시 입력한다 — 두 시계를 다 걷는다 */
  reset: () => void
}

/**
 * 인증코드 시계 배선 (#1309) — 가입 2단계와 재설정 2단계가 같이 쓴다. 계산은 순수 함수
 * (`lib/form/code-timers.ts`)에 있고 여기는 상태와 재렌더만 든다.
 *
 * **남은 초를 state 로 들지 않는다.** 마감 시각을 들고 렌더마다 `Date.now()` 로 다시 계산한다 —
 * interval 은 재렌더를 일으키는 용도뿐이라 백그라운드 탭에서 스로틀링돼도 값이 어긋나지 않는다
 * (form-guide.md §2). 예전에는 두 폼이 이 보일러플레이트(시작 시각 · 강제 틱 · interval)를 각자 들었다.
 *
 * interval 은 **시계가 하나라도 돌 때만** 건다. 둘 다 0 이 되면 effect 가 정리한다.
 */
export function useCodeTimers(): UseCodeTimersReturn {
  const [timers, setTimers] = useState<CodeTimers>(NO_CODE_TIMERS)
  // 값은 쓰지 않는다 — 1초마다 재렌더를 일으키는 용도다
  const [, forceTick] = useState(0)

  const { cooldownSeconds, expiresInSeconds } = codeTimerSeconds(timers, Date.now())
  const active = cooldownSeconds > 0 || (expiresInSeconds ?? 0) > 0

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => forceTick((tick) => tick + 1), 1000)
    return () => clearInterval(interval)
    // `timers` 가 바뀌면 다시 건다 — 새 마감 시각에 틱을 맞춘다
  }, [active, timers])

  const start = useCallback((info: VerificationCodeSendResponse) => {
    setTimers(startCodeTimers(info, Date.now()))
  }, [])

  const coolDown = useCallback((seconds: number | null) => {
    setTimers((previous) =>
      coolDownFor(previous, seconds ?? RESEND_COOLDOWN_FALLBACK_SECONDS, Date.now()),
    )
  }, [])

  const reset = useCallback(() => setTimers(NO_CODE_TIMERS), [])

  return { cooldownSeconds, expiresInSeconds, start, coolDown, reset }
}
