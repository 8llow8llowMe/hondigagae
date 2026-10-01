import { redirect } from 'next/navigation'

import type { Metadata } from 'next'

import { AuthCardDog } from '@/features/auth/auth-card-dog'
import { LoginMethods } from '@/features/auth/login-form'
import { SignupDoneNotice } from '@/features/auth/signup-done-notice'
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

  // 이미 로그인했으면 안내하지 않고 목적지로 보낸다 (#1082, 로그인 세부명세 D3)
  if (session !== null) redirect(target)

  return (
    <div className="flex flex-col gap-4">
      <AuthCardDog />
      <SignupDoneNotice signedUp={signedUp} />
      {/* 비밀번호 변경·소셜 전용 전환·탈퇴로 세션이 끊긴 경우 그 이유를 알린다 */}
      <ReauthNotice reauth={reauth} />
      {/* 이메일 폼 · "또는" · 소셜 버튼 · 회원가입 입구 — 한 클라이언트 경계다 (#1084, `LoginMethods`) */}
      <LoginMethods returnTo={target} initialEmail={email ?? ''} />
    </div>
  )
}
