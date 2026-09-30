import type { Metadata } from 'next'

import { AuthCardDog } from '@/features/auth/auth-card-dog'
import { LoggedInNotice } from '@/features/auth/logged-in-notice'
import { LoginDivider, LoginForm, LoginSignupPrompt } from '@/features/auth/login-form'
import { SignupDoneNotice } from '@/features/auth/signup-done-notice'
import { SocialLoginButtons } from '@/features/auth/social-login-buttons'
import { ReauthNotice } from '@/features/member/reauth-notice'
import { readSession } from '@/lib/auth/session'
import { safeReturnTo } from '@/lib/http/redirect'
import { messages } from '@/lib/messages'

export const metadata: Metadata = { title: `${messages.auth.loginTitle} · 혼디가개` }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; email?: string; signedUp?: string; reauth?: string }>
}) {
  const { returnTo, email, signedUp, reauth } = await searchParams
  // 쿼리스트링은 사용자가 조작할 수 있다. 그대로 리다이렉트하면 오픈 리다이렉트다
  const target = safeReturnTo(returnTo)
  const session = await readSession()

  if (session !== null) return <LoggedInNotice returnTo={target} />

  return (
    <div className="flex flex-col gap-4">
      <AuthCardDog />
      <SignupDoneNotice signedUp={signedUp} />
      {/* 비밀번호 변경·소셜 전용 전환·탈퇴로 세션이 끊긴 경우 그 이유를 알린다 */}
      <ReauthNotice reauth={reauth} />
      <LoginForm returnTo={target} initialEmail={email ?? ''} />
      {/*
        소셜 로그인은 폼 아래에 둔다 — 기본 수단은 이메일 로그인이다. "또는" 이 두 수단이
        서로 대신한다는 것을 말한다: 선 없이 붙어 있으면 소셜 버튼이 이메일 로그인의 다음
        단계로 읽힌다 (#1081).

        **소셜 로그인은 기억한 이메일을 읽지도 쓰지도 않는다.** 제공자가 이메일을 정하므로
        우리가 채울 칸이 없고, 성공해도 그 이메일이 이메일 로그인에 쓰일 수 있는 계정인지
        (비밀번호가 있는지) 모른다.
      */}
      <LoginDivider />
      <SocialLoginButtons returnTo={target} />
      <LoginSignupPrompt returnTo={target} />
    </div>
  )
}
