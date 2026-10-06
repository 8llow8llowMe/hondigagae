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
    회원가입 화면에도 소셜 버튼을 둔다. 미가입 이메일이면 서버가 자동으로 가입시키므로
    로그인 화면과 결과가 같다 — 여기에만 없으면 3단계를 다 밟은 뒤에야 더 짧은 길이
    있었다는 것을 알게 된다 (정본 D8-3).

    폼과 소셜 버튼이 **가입 동의를 함께 쓴다.** 그 상태를 들 주인이 필요해 클라이언트
    컴포넌트 하나(`SignupScreen`)로 묶었다 — 서버 컴포넌트인 이 페이지는 상태를 들 수
    없다 (#688).
  */
  return (
    /*
      **로그인 화면과 같은 래퍼다** (#1157). 예전에는 fragment 라 카드 안 첫 요소가 곧 `회원가입`
      제목이었는데, 안내가 그 위에 서면서 둘이 붙었다 — 로그인(`login/page.tsx`)의 `gap-4` 와 맞춘다.
    */
    <div className="flex flex-col gap-4">
      <AuthCardDog />
      {/* 로그인 화면에서 넘어와도 같은 맥락을 이어받는다 — `returnTo` 가 그대로 실려 온다 */}
      <LoginReasonNotice returnTo={target} screen="signup" />
      <SignupScreen returnTo={target} />
    </div>
  )
}
