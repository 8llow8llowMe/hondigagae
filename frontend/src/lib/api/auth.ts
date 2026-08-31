import { clientFetch, clientFetchVoid } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'

/**
 * 인증 API 호출부.
 *
 * **accessToken 은 응답에 오지만 BFF 가 제거한다.** 브라우저에 남는 것은
 * memberId 뿐이다 — docs/auth-guide.md §8.
 */
export type LoginRequest = { email: string; password: string }
export type LoginResult = { memberId: string }

export type SignupRequest = {
  email: string
  password: string
  name: string
  nickname: string
}

export function login(values: LoginRequest): Promise<LoginResult> {
  return clientFetch<LoginResult>(paths.auth.login, { method: 'POST', body: values })
}

/** dataBody 없이 성공한다 */
export function logout(): Promise<void> {
  return clientFetchVoid(paths.auth.logout, { method: 'POST' })
}

/** 가입 여부와 무관하게 항상 성공한다 — 계정 열거 방지 */
export function sendEmailCode(email: string): Promise<void> {
  return clientFetchVoid(paths.auth.emailSendCode, { method: 'POST', body: { email } })
}

/** 성공하면 서버에 "이 이메일은 인증됨(30분)" 이 남는다. 토큰을 주지 않는다 */
export function verifyEmailCode(email: string, code: string): Promise<void> {
  return clientFetchVoid(paths.auth.emailVerifyCode, { method: 'POST', body: { email, code } })
}

/** dataBody 가 null 이라 자동 로그인이 되지 않는다 */
export function signup(values: SignupRequest): Promise<void> {
  return clientFetchVoid(paths.members.signup, { method: 'POST', body: values })
}

export type PasswordResetRequest = { email: string; code: string; newPassword: string }

/**
 * 비밀번호 재설정 코드 발송.
 *
 * **가입 여부와 무관하게 항상 성공한다** — 미가입 이메일·소셜 전용 계정에는 각각
 * 안내 메일이 나간다. 호출부가 성공/실패로 계정 존재를 판정하면 안 된다
 * (비밀번호찾기-세부명세.md D1).
 *
 * 실패는 429 둘뿐이다: `AUTH_003`(이메일당 60초) · `AUTH_016`(IP 시간당 상한).
 */
export function sendPasswordResetCode(email: string): Promise<void> {
  return clientFetchVoid(paths.auth.passwordResetSendCode, { method: 'POST', body: { email } })
}

/**
 * 비밀번호 재설정. **성공하면 전 기기 세션이 무효화된다** — 재로그인이 필요하다.
 *
 * `AUTH_004`(불일치)만 그 자리에서 다시 입력한다. `AUTH_005`(만료·미발급)와
 * `AUTH_017`(5회 초과)은 코드가 더는 유효하지 않아 다시 받아야 한다.
 */
export function resetPassword(values: PasswordResetRequest): Promise<void> {
  return clientFetchVoid(paths.auth.passwordReset, { method: 'POST', body: values })
}

/** 소셜 로그인 1단계. 이 URL 로 사용자를 보내는 것은 **우리가** 한다 (서버가 리다이렉트하지 않는다) */
export type OAuthAuthorizeResult = { authorizationUrl: string }

export function oauthAuthorize(provider: string): Promise<OAuthAuthorizeResult> {
  return clientFetch<OAuthAuthorizeResult>(paths.auth.oauthAuthorize(provider))
}

/**
 * 소셜 로그인 4단계 — 콜백에서 받은 `code`·`state` 를 세션으로 교환한다.
 *
 * **반드시 BFF 를 거친다.** 응답은 일반 로그인과 같은 모양이라 BFF 가 `accessToken` 을
 * 벗겨 세션 쿠키에 봉인한다. 게이트웨이를 직접 부르면 토큰이 브라우저 JS 에 노출된다.
 *
 * 미가입 이메일이면 서버가 **자동 회원가입 후 로그인**한다 — 화면에 가입 단계가 없다.
 */
export function oauthLogin(provider: string, code: string, state: string): Promise<LoginResult> {
  return clientFetch<LoginResult>(paths.auth.oauthLogin(provider, code, state))
}
