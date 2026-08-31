import type { Metadata } from 'next'

import { LoggedInNotice } from '@/features/auth/logged-in-notice'
import { LoginForm } from '@/features/auth/login-form'
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
      <SignupDoneNotice signedUp={signedUp} />
      {/* 비밀번호 변경·소셜 전용 전환·탈퇴로 세션이 끊긴 경우 그 이유를 알린다 */}
      <ReauthNotice reauth={reauth} />
      <LoginForm returnTo={target} initialEmail={email ?? ''} />
      {/* 소셜 로그인은 폼 아래에 둔다 — 기본 수단은 이메일 로그인이다 */}
      <SocialLoginButtons returnTo={target} />
    </div>
  )
}
