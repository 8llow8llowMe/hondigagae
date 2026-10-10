import { clientFetch, clientFetchVoid } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type { SignupConsent } from '@/lib/auth/signup-consent'

/**
 * 인증 API 호출부.
 *
 * **accessToken 은 응답에 오지만 BFF 가 제거한다.** 브라우저에 남는 것은
 * memberId 뿐이다 — docs/auth-guide.md §8.
 */
export type LoginRequest = { email: string; password: string }
export type LoginResult = { memberId: string }

/**
 * 일반 회원가입 요청.
 *
 * **동의 3종은 선택이 아니라 필수다** (백엔드 #607 · #608). `@AssertTrue` 라
 * 빠뜨리거나 `false` 면 400 이고, 각각 `MEMBER_115` / `MEMBER_116` / `MEMBER_117` 로
 * `field` 와 함께 온다 — `MemberGeneralSignupRequest` 실측.
 */
export type SignupRequest = SignupConsent & {
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

/**
 * `consent` 는 **최초 연동(= 신규 가입)에서만** 쓰인다. 기존 회원 로그인은 생략한다
 * — 백엔드 기본값이 전부 false 이고, 이미 가입한 회원의 로그인은 동의 여부와 무관하게
 * 통과한다 (`OAuthLoginProcessor`).
 *
 * **여기가 동의를 실을 수 있는 유일한 지점이다.** 콜백의 인가코드는 1회용이라 그
 * 시점에 거부당하면 사용자가 제공자 인가 화면부터 다시 밟아야 한다.
 */
export function oauthAuthorize(
  provider: string,
  consent?: SignupConsent,
): Promise<OAuthAuthorizeResult> {
  return clientFetch<OAuthAuthorizeResult>(paths.auth.oauthAuthorize(provider, consent))
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
