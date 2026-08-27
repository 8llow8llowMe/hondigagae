/**
 * 재발급 시도 제한.
 * 401 을 받으면 reissue 를 1회만 시도하고, 실패하면 세션을 비우고 로그인으로 보낸다.
 * 무한 루프를 만들지 않는다 — docs/auth-guide.md §3.
 */
export const MAX_REISSUE_ATTEMPTS = 1

export function canRetryReissue(attempt: number): boolean {
  return attempt < MAX_REISSUE_ATTEMPTS
}

/** reissue 엔드포인트 자체의 401 은 재발급으로 복구할 수 없다 */
export function isReissuePath(path: string): boolean {
  return path.replace(/^\/+/, '').startsWith('auth/token/reissue')
}

/**
 * 인증 진입 엔드포인트인가 (일반 로그인 / 소셜 로그인 콜백).
 *
 * **이 경로들의 401 은 토큰 만료가 아니라 로그인 실패다** (AUTH_006).
 * 재발급으로 복구되지 않는데도 재시도하면 같은 자격증명으로 실패가 2회
 * 카운트되어 AUTH_015 잠금이 절반의 시도로 걸린다
 * — docs/features/auth/공통명세.md S4.
 */
const AUTH_ENTRY_PATTERN = /^auth\/(login|[^/]+\/login)$/

export function isAuthEntryPath(path: string): boolean {
  const withoutQuery = path.split('?')[0] ?? ''
  return AUTH_ENTRY_PATTERN.test(withoutQuery.replace(/^\/+/, ''))
}
