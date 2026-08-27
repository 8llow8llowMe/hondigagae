import type { Metadata } from 'next'

import { LoggedInNotice } from '@/features/auth/logged-in-notice'
import { SignupForm } from '@/features/auth/signup-form'
import { readSession } from '@/lib/auth/session'
import { safeReturnTo } from '@/lib/http/redirect'
import { messages } from '@/lib/messages'

export const metadata: Metadata = { title: `${messages.auth.signupTitle} · 혼디가개` }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  // 쿼리스트링은 사용자가 조작할 수 있다. 그대로 리다이렉트하면 오픈 리다이렉트다
  const target = safeReturnTo(returnTo)
  const session = await readSession()

  if (session !== null) return <LoggedInNotice returnTo={target} />

  return <SignupForm returnTo={target} />
}
