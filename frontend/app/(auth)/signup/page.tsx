import { redirect } from 'next/navigation'

import type { Metadata } from 'next'

import { AuthCardDog } from '@/features/auth/auth-card-dog'
import { LoginReasonNotice } from '@/features/auth/login-reason-notice'
import { SignupScreen } from '@/features/auth/signup-screen'
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

  // 이미 로그인했으면 안내하지 않고 목적지로 보낸다 (#1082, 회원가입 세부명세 D5)
  if (session !== null) redirect(target)

  /*
    **가입 방법 고르기 → 이메일 3단계 · 약관 시트는 전부 `SignupScreen` 안이다** (#1284). 국면마다
    상단바 `←` 의 목적지가 달라(로그인 화면 / 방법 고르기 / 이메일 단계) 상단바도 그 안에 있다.

    왜 왔는지 안내(#1157)는 진입 화면에만 선다 — 이메일 단계는 그 화면의 질문 한 줄이 제목이라
    안내가 위에 끼면 질문이 밀린다. 서버 컴포넌트가 그린 요소를 그대로 넘긴다.
  */
  return (
    <>
      <AuthCardDog />
      <SignupScreen
        returnTo={target}
        notice={<LoginReasonNotice returnTo={target} screen="signup" />}
      />
    </>
  )
}
