/**
 * 같은 오리진 리다이렉트 헬퍼.
 *
 * `NextResponse.redirect(request.nextUrl…)` 는 standalone 서버에서
 * `http://0.0.0.0:3000` 으로 나가 깨진다. 경로 기반으로 만든다
 * — docs/architecture-guide.md §7.
 */
const HOME_PATH = '/'

/** 이 경로들로 돌아가면 리다이렉트 루프가 된다 */
const AUTH_PATHS = ['/login', '/signup'] as const

/**
 * 제어문자(개행, 탭, NUL 등)는 URL 파싱을 흔들어 우회에 쓰인다.
 * C0 제어문자(0x00-0x1F)와 DEL(0x7F) 전체를 잡는다.
 */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

/**
 * `returnTo` 처럼 사용자가 조작할 수 있는 값을 안전한 내부 경로로 좁힌다.
 *
 * **`/` 로 시작하는 같은 오리진 경로만 허용한다.** 그대로 리다이렉트하면
 * 오픈 리다이렉트다 — 공격자가 로그인 직후 외부 사이트로 보낼 수 있다.
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return HOME_PATH

  const value = raw.trim()
  if (value.length === 0) return HOME_PATH
  if (CONTROL_CHARS.test(value)) return HOME_PATH

  // 절대 URL·스킴(javascript:, data:)은 '/' 로 시작하지 않으므로 여기서 걸린다
  if (!value.startsWith('/')) return HOME_PATH

  // '//evil.com' 은 프로토콜 상대 URL, '/\evil.com' 은 브라우저가 그것과 동일하게 해석한다
  if (value.startsWith('//') || value.startsWith('/\\')) return HOME_PATH

  const pathname = value.split('?')[0] ?? ''
  if (AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return HOME_PATH
  }

  return value
}
