import type { Metadata } from 'next'

import { LoggedInNotice } from '@/features/auth/logged-in-notice'
import { LoginForm } from '@/features/auth/login-form'
import { SignupDoneNotice } from '@/features/auth/signup-done-notice'
import { readSession } from '@/lib/auth/session'
import { safeReturnTo } from '@/lib/http/redirect'
import { messages } from '@/lib/messages'

export const metadata: Metadata = { title: `${messages.auth.loginTitle} · 혼디가개` }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; email?: string; signedUp?: string }>
}) {
  const { returnTo, email, signedUp } = await searchParams
  // 쿼리스트링은 사용자가 조작할 수 있다. 그대로 리다이렉트하면 오픈 리다이렉트다
  const target = safeReturnTo(returnTo)
  const session = await readSession()

  if (session !== null) return <LoggedInNotice returnTo={target} />

  return (
    <div className="flex flex-col gap-4">
      <SignupDoneNotice signedUp={signedUp} />
      <LoginForm returnTo={target} initialEmail={email ?? ''} />
    </div>
  )
}
