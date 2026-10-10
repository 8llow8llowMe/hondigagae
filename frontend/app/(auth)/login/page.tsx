import { redirect } from 'next/navigation'

import type { Metadata } from 'next'

import { AuthBrand } from '@/features/auth/auth-brand'
import { AuthCardDog } from '@/features/auth/auth-card-dog'
import { LoginMethods } from '@/features/auth/login-form'
import { LoginReasonNotice } from '@/features/auth/login-reason-notice'
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
    /*
      **위 여백(48)이 락업을 화면 첫 시선 자리에 앉힌다** (#1283). 셸이 위쪽 정렬이 되면서
      (C2) 이 화면만 들어오는 자리라 숨을 둔다 — 하위 화면은 그 자리에 `←` 상단바가 선다.
      데스크톱 카드 안에서는 카드 패딩이 그 일을 한다.

      `gap-6` — 락업 · 소셜 · "또는" · 폼 · 링크 줄이 서로 다른 덩어리라 폼 안 간격(16)보다
      한 단계 벌린다.
    */
    <div className="flex flex-col gap-6 pt-12 md:pt-0">
      <AuthCardDog />
      {/*
        **보이는 "로그인" 제목을 걷는다** (#1283 C4). 락업이 이미 어느 서비스의 무슨 화면인지
        말하고, 그 아래 같은 무게의 "로그인" 이 또 서면 제목이 둘이 된다. 문서 개요에는 남겨
        두어야 하므로 sr-only 다 — 첫 제목이 락업보다 앞에 오게 둔다.
      */}
      <h1 className="sr-only">{messages.auth.loginTitle}</h1>
      <AuthBrand tagline={messages.auth.loginTagline} />
      <SignupDoneNotice signedUp={signedUp} />
      {/* 비밀번호 변경·소셜 전용 전환·탈퇴로 세션이 끊긴 경우 그 이유를 알린다 */}
      <ReauthNotice reauth={reauth} />
      {/*
        왜 로그인이 필요한지 (#1157). **다른 안내가 섰으면 내지 않는다** — 가입 완료 · 재로그인
        안내가 이미 이 화면에 온 이유를 말하고 있어, 둘을 쌓으면 첫 줄이 가려진다.
      */}
      {signedUp !== '1' && reauth === undefined && (
        <LoginReasonNotice returnTo={target} screen="login" />
      )}
      {/* 소셜 · "또는" · 이메일 폼 · 링크 줄 — 한 클라이언트 경계다 (#1084, `LoginMethods`) */}
      <LoginMethods returnTo={target} initialEmail={email ?? ''} />
    </div>
  )
}
