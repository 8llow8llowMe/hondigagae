import type { Metadata } from 'next'

import { LoggedInNotice } from '@/features/auth/logged-in-notice'
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

  if (session !== null) return <LoggedInNotice returnTo={target} />

  /*
    회원가입 화면에도 소셜 버튼을 둔다. 미가입 이메일이면 서버가 자동으로 가입시키므로
    로그인 화면과 결과가 같다 — 여기에만 없으면 3단계를 다 밟은 뒤에야 더 짧은 길이
    있었다는 것을 알게 된다 (정본 D8-3).

    폼과 소셜 버튼이 **가입 동의를 함께 쓴다.** 그 상태를 들 주인이 필요해 클라이언트
    컴포넌트 하나(`SignupScreen`)로 묶었다 — 서버 컴포넌트인 이 페이지는 상태를 들 수
    없다 (#688).
  */
  return <SignupScreen returnTo={target} />
}
