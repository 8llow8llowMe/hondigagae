import { FormNotice } from '@/components/form-notice'
import { loginPurposeFor } from '@/lib/auth/login-reason'
import { messages } from '@/lib/messages'

/**
 * 표시 전용. 로그인 · 회원가입 화면 머리에 **왜 로그인이 필요한지** 한 줄로 말한다 (#1157).
 *
 * 홈의 `AI로 일정 짜기` 를 누른 비로그인 사용자가 아무 설명 없이 로그인 폼을 마주했다
 * (2026-10-06 사용성 점검). 돌아가는 처리(`returnTo`)는 이미 잘 됐다 — 빠진 것은 문구였다.
 *
 * 서버 컴포넌트(`app/(auth)/*`)와 분리한 별도 파일인 이유는 `SignupDoneNotice` 와 같다 —
 * 같은 파일에 두면 렌더 테스트가 `env.server.ts` 의 필수 env 파싱까지 끌고 온다.
 */
export function LoginReasonNotice({
  returnTo,
  screen,
}: {
  /** `safeReturnTo` 로 검증한 돌아갈 곳 */
  returnTo: string
  screen: 'login' | 'signup'
}) {
  const purpose = loginPurposeFor(returnTo)
  if (purpose === null) return null

  const template = screen === 'login' ? messages.auth.loginReason : messages.auth.signupReason
  return <FormNotice message={template.replace('{purpose}', purpose)} />
}
