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
