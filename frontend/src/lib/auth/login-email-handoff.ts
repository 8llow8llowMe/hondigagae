/**
 * 다른 화면이 로그인 화면으로 **이메일을 넘긴다** (#1158).
 *
 * 예전에는 `/login?email=…` 쿼리로 넘겼다 — 가입 완료 · 중복 가입(409) "로그인하기" · 비밀번호
 * 재설정 완료. 이메일이 브라우저 기록 · 서버 접근 로그 · Referer 에 남는다. 그래서 **탭 범위**
 * (`sessionStorage`)에 한 번 넘기고, 로그인 화면이 **한 번 읽고 지운다.**
 *
 * - **토큰이 아니라 이메일이다** — `auth-guide.md` 가 브라우저 저장소에 금지하는 것은 토큰이고,
 *   이 저장소는 `saved-login-email.ts`(이메일 기억하기)와 같은 판단이다
 * - 새 탭에서 열면 넘어가지 않는다 — 탭 범위라서다. 그때는 직접 입력한다
 * - 모든 접근은 `try/catch` 다. 사파리 프라이빗 모드 등에서 접근 자체가 던지고, 편의일 뿐이다
 *
 * 로그인 화면은 `?email=` 쿼리도 여전히 읽는다 — 예전 링크 · 북마크가 깨지지 않게.
 */
const STORAGE_KEY = 'hdg_login_email_handoff'

export const LOGIN_EMAIL_HANDOFF_STORAGE_KEY = STORAGE_KEY

export function handOffLoginEmail(email: string): void {
  const value = email.trim()
  if (value.length === 0) return
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, value)
  } catch {
    // 넘기지 못하면 로그인 화면에서 직접 입력한다
  }
}

/** 넘겨받은 이메일. **읽으면 지운다** — 한 번의 이동에만 쓰인다 */
export function takeHandedOffLoginEmail(): string | null {
  try {
    const storage = globalThis.sessionStorage
    const value = storage?.getItem(STORAGE_KEY)?.trim() ?? ''
    storage?.removeItem(STORAGE_KEY)
    return value.length === 0 ? null : value
  } catch {
    return null
  }
}
