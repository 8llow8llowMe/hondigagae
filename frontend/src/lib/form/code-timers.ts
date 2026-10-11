import type { VerificationCodeSendResponse } from '@/types/auth'

/**
 * 인증코드 시계 — 재발송 쿨다운과 코드 만료 (#1309). **순수 함수** — docs/form-guide.md §2.
 *
 * **마감 시각을 들고 매번 다시 계산한다.** "남은 초" 를 `setInterval` 로 1씩 깎지 않는다 —
 * 백그라운드 탭에서 타이머가 스로틀링돼도 남은 초가 어긋나지 않는다(회원가입-세부명세.md D7).
 * 예전 `cooldown.ts` 의 `remainingSeconds(startedAt, duration, now)` 와 같은 뜻이고, 길이를 FE 가
 * 박지 않고 **응답 값**(`resendAvailableInSeconds` · `codeExpiresInSeconds` · `Retry-After`)으로
 * 받게 되면서 시작 시각 대신 마감 시각을 든다.
 *
 * 훅 배선은 `features/auth/use-code-timers.ts`.
 */
export type CodeTimers = {
  /** 다시 보낼 수 있는 시각(ms). null 이면 쿨다운이 없다 */
  resendAt: number | null
  /** 지금 코드가 만료되는 시각(ms). null 이면 아직 받은 코드가 없다 */
  expiresAt: number | null
}

export const NO_CODE_TIMERS: CodeTimers = { resendAt: null, expiresAt: null }

/**
 * 429 에 `Retry-After` 가 없을 때의 쿨다운. 백엔드 이메일당 재발송 간격(`RESEND_COOLDOWN`)과 같다.
 * 헤더는 BE #1293 부터 늘 오지만, 배포 순서가 어긋나거나 헤더가 빠져도 버튼을 바로 풀지 않는다.
 */
export const RESEND_COOLDOWN_FALLBACK_SECONDS = 60

/** 마감 시각까지 남은 초. 올림이라 0.2초 남아도 1이다. 마감이 없거나 지났으면 0 */
export function secondsUntil(deadline: number | null, now: number): number {
  if (deadline === null) return 0
  const remaining = Math.ceil((deadline - now) / 1000)
  return remaining > 0 ? remaining : 0
}

/** 발송 성공(최초 · 재발송) — 응답 값으로 두 시계를 새로 건다. 옛 코드는 무효가 됐다 */
export function startCodeTimers(info: VerificationCodeSendResponse, now: number): CodeTimers {
  return {
    resendAt: now + info.resendAvailableInSeconds * 1000,
    expiresAt: now + info.codeExpiresInSeconds * 1000,
  }
}

/**
 * 다시 보내지 못했다(429) — **쿨다운만** 새로 건다. 새 코드가 오지 않았으니 지금 코드의 만료는 그대로다.
 */
export function coolDownFor(timers: CodeTimers, seconds: number, now: number): CodeTimers {
  return { ...timers, resendAt: now + seconds * 1000 }
}

export type CodeTimerSeconds = {
  /** 다시 보낼 수 있을 때까지 남은 초. 0 이면 보낼 수 있다 */
  cooldownSeconds: number
  /** 코드 만료까지 남은 초. **지났으면 0, 받은 코드가 없으면 null** — 화면이 셋을 가른다 */
  expiresInSeconds: number | null
}

export function codeTimerSeconds(timers: CodeTimers, now: number): CodeTimerSeconds {
  return {
    cooldownSeconds: secondsUntil(timers.resendAt, now),
    expiresInSeconds: timers.expiresAt === null ? null : secondsUntil(timers.expiresAt, now),
  }
}

/**
 * 쿨다운 중 스크린리더에 알릴 초. 알리지 않으면 null.
 *
 * 매 초 바뀌는 값을 live 영역에 그대로 실으면 초마다 읽힌다 — 보이는 초는 버튼 라벨(비-live)에 두고
 * 알림은 드물게 낸다(회원가입-세부명세 D6). 1분 미만은 10초 단위, 이상은 **분 경계**에서만이다 —
 * 표기가 분 단위(`formatWait`)라 10초마다 알리면 "59분" 을 여섯 번 되풀이한다.
 */
export function cooldownAnnounceSeconds(cooldownSeconds: number): number | null {
  if (cooldownSeconds <= 0) return null
  const step = cooldownSeconds < 60 ? 10 : 60
  return cooldownSeconds % step === 0 ? cooldownSeconds : null
}

/** 만료까지 남은 시간 중 스크린리더에 알릴 초 — **분 경계와 만료 순간**뿐이다. 알리지 않으면 null */
export function expiryAnnounceSeconds(expiresInSeconds: number | null): number | null {
  if (expiresInSeconds === null) return null
  return expiresInSeconds % 60 === 0 ? expiresInSeconds : null
}
