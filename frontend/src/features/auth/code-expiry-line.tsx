import { expiryAnnounceSeconds } from '@/lib/form/code-timers'
import { messages } from '@/lib/messages'

export type CodeExpiryLineProps = {
  /** 코드 만료까지 남은 초. 지났으면 0, 받은 코드가 없으면 null — 셋을 다르게 그린다 */
  expiresInSeconds: number | null
}

function expiryText(seconds: number): string {
  return seconds > 0 ? messages.auth.codeExpiresIn(seconds) : messages.auth.codeExpired
}

/**
 * 코드 칸 아래 만료 줄 (#1309) — 가입 2단계 · 재설정 2단계가 같이 쓴다. 상태 없는 표시 컴포넌트다.
 *
 * - `> 0` → "코드는 4분 59초 뒤 만료돼요"
 * - `0` → "코드가 만료됐어요. 다시 보내기로 새 코드를 받아 주세요."
 * - `null` → 그리지 않는다 (받은 코드가 없다)
 *
 * **보이는 줄은 live 가 아니다.** 매 초 바뀌어 live 에 실으면 초마다 읽힌다 — 알림은 따로 두고
 * 분 경계와 만료 순간에만 낸다(`expiryAnnounceSeconds`). 재발송 쿨다운의 `announceSeconds` 와 같은 처리다.
 *
 * **만료돼도 제출을 막지 않는다.** 서버가 `AUTH_005` 로 답하고 1단계로 되돌리는 흐름이 이미 있다 —
 * 시계가 어긋난 기기에서 FE 가 먼저 막으면 아직 유효한 코드를 못 내게 된다.
 */
export function CodeExpiryLine({ expiresInSeconds }: CodeExpiryLineProps) {
  if (expiresInSeconds === null) return null
  const announce = expiryAnnounceSeconds(expiresInSeconds)
  const expired = expiresInSeconds === 0

  return (
    <>
      <p
        data-code-expiry={expired ? 'expired' : 'counting'}
        className={expired ? 'text-caption text-fg' : 'text-caption text-fg-muted'}
      >
        {expiryText(expiresInSeconds)}
      </p>
      <span data-code-expiry-live="" aria-live="polite" className="sr-only">
        {announce !== null ? expiryText(announce) : ''}
      </span>
    </>
  )
}
