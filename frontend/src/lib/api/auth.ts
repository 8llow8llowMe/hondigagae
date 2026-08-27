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
