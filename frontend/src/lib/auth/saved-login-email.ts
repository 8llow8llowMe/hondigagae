/**
 * 로그인 화면의 "이메일 기억하기" — 로그인-세부명세 D10 (이슈 #1081).
 *
 * **이메일 하나만 남긴다. 비밀번호도 토큰도 아니다** — `auth-guide.md` 가 브라우저 저장소에
 * 금지하는 것은 토큰이고, 로그인 아이디는 비밀이 아니다 (`recent-place.ts` 와 같은 판단).
 * 그래도 공용 기기에서는 남의 눈에 띄는 값이라 **기본은 꺼짐**이고, 켜면 화면이 그 사실을
 * 캡션으로 말한다.
 *
 * 저장 규칙은 이 파일이 아니라 호출부가 지킨다 — 여기는 저장소 접근과 판정만 둔다:
 *  - **로그인 성공 시에만** 저장한다 (`login-form.tsx`). 실패한 이메일(오타 · `MEMBER_007`
 *    소셜 전용)을 기억하면 다음 방문에 틀린 값이 채워진다.
 *  - 체크를 **해제하면 즉시** 지운다 — 로그인을 끝까지 하지 않고 떠나도 남지 않게.
 *  - 탈퇴 · 소셜 전용 전환이 성공하면 지운다 (`forgetsSavedLoginEmail`).
 *
 * 모든 저장소 접근은 `try/catch` 다. 사파리 프라이빗 모드 등에서 접근 자체가 던지고,
 * 이 기능은 편의일 뿐이라 실패해도 로그인은 그대로 된다.
 */
const STORAGE_KEY = 'hdg_saved_login_email'

export const SAVED_LOGIN_EMAIL_STORAGE_KEY = STORAGE_KEY

export function readSavedLoginEmail(): string | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)?.trim() ?? ''
    return value.length === 0 ? null : value
  } catch {
    return null
  }
}

/** 빈 값이 오면 저장하지 않고 지운다 — 빈 문자열을 "기억한 이메일" 로 남기지 않는다 */
export function saveLoginEmail(email: string): void {
  const value = email.trim()
  if (value.length === 0) {
    clearSavedLoginEmail()
    return
  }
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value)
  } catch {
    // 저장 실패는 무시한다 — 다음 방문에 직접 입력하면 된다
  }
}

export function clearSavedLoginEmail(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // 지우지 못해도 화면은 이미 체크 해제 상태다
  }
}

/**
 * 첫 화면의 이메일 값과 체크 상태.
 *
 * **`?email=` 쿼리가 저장값을 이긴다.** 쿼리는 방금 가입했거나(`signedUp=1&email=`)
 * 다른 화면이 "이 계정으로 로그인하라" 고 넘긴 **지금의 의도**이고, 저장값은 지난번의
 * 기억이다.
 *
 * **체크 상태는 쿼리와 무관하게 저장값 유무를 따른다.** 사용자가 이 기기에서 기억하기를
 * 켜 둔 선택은 이메일 칸에 무엇이 채워졌든 유효하다 — 쿼리가 왔다고 꺼 버리면 로그인
 * 성공 뒤 저장이 조용히 멈춘다. 켜진 체크와 캡션이 그대로 보이므로 사용자가 끌 수 있다.
 */
export function resolveInitialLoginEmail(
  queryEmail: string,
  savedEmail: string | null,
): { email: string; remember: boolean } {
  const fromQuery = queryEmail.trim()
  return {
    email: fromQuery.length > 0 ? fromQuery : (savedEmail ?? ''),
    remember: savedEmail !== null,
  }
}

/**
 * 세션이 끝나는 이유 중 기억한 이메일을 지워야 하는 것.
 *
 *  - `withdrawn` — 그 이메일로는 더 이상 로그인할 수 없다
 *  - `password-removed` — 소셜 전용이 되어 이메일 로그인이 `MEMBER_007` 로 막힌다
 *
 * 로그아웃 · 비밀번호 변경(`password-changed`)은 남긴다 — 같은 이메일로 다시 들어온다.
 * 인자는 `ReauthReason`(`features/member/use-session-exit.ts`)이지만 `lib` 가 `features` 를
 * 가져오지 않도록 문자열로 받는다.
 */
export function forgetsSavedLoginEmail(reason: string | undefined): boolean {
  return reason === 'withdrawn' || reason === 'password-removed'
}
