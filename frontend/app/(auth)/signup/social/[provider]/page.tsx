import { notFound } from 'next/navigation'

import type { Metadata } from 'next'

import { AuthCardDog } from '@/features/auth/auth-card-dog'
import { LoggedInNotice } from '@/features/auth/logged-in-notice'
import { SocialSignupConsentScreen } from '@/features/auth/social-signup-consent-screen'
import { isOAuthProvider } from '@/lib/auth/oauth-provider'
import { readSession } from '@/lib/auth/session'
import { safeReturnTo } from '@/lib/http/redirect'
import { messages } from '@/lib/messages'

export const metadata: Metadata = { title: `${messages.auth.signupTitle} · 혼디가개` }

/**
 * 소셜 최초 연동의 가입 동의 화면 — 이슈 #707.
 *
 * 소셜 콜백이 `MEMBER_010` / `MEMBER_011` 로 거부했을 때의 목적지다. 예전에는 `/signup`
 * 이었는데, 그 화면에는 이 사용자에게 쓸모없는 이메일 폼과 **다른 제공자 버튼**이 함께
 * 있었다 (`social-signup-consent-screen.tsx` 머리주석).
 *
 * **보호 경로가 아니다** — 아직 로그인되지 않은 사람이 지나는 자리라 `proxy.ts` 의
 * `PROTECTED_PATHS` 에 올리지 않는다. `/signup` · `/login` 과 같다.
 *
 * `loading.tsx` 를 두지 않는다. 아래 `notFound()` 가 HTTP 상태를 404 로 바꿔야 하는데,
 * 경계가 있으면 응답이 먼저 스트리밍돼 200 으로 굳는다 — `(auth)/layout.tsx` 와 같은 판단.
 */
export default async function SocialSignupConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { provider } = await params

  /*
    **모르는 제공자는 404 다.** 경로 세그먼트는 사용자가 손으로 바꿀 수 있고,
    `/signup/social/foo` 는 우리에게 존재한 적 없는 주소다.

    소셜 콜백(`oauth/[provider]/callback`)이 같은 상황에서 404 대신 "잘못된 접근이에요"
    를 그리는 것은 **그 자리가 제공자가 돌려보내는 착지점**이라, 제공자 설정이 어긋난
    경우까지 사용자에게 다음 행동을 줘야 해서다. 이 화면은 우리 링크로만 들어오므로
    그런 사정이 없고, 200 으로 답하면 크롤러가 없는 페이지를 정상으로 읽고 모니터링도
    실패를 세지 못한다 (`proxy.ts` 의 잘못된 장소 id 처리와 같은 이유).

    **세션을 읽기 전에 거른다.** 뒤로 미루면 잘못된 주소에 쿠키 복호화 비용을 태우는 데다,
    세션이 있는 사용자에게는 404 대신 `LoggedInNotice` 가 나가 **같은 주소가 세션 유무로
    다른 상태를 답한다.** 이 순서는 `page.test.ts` 가 잠근다.
  */
  if (!isOAuthProvider(provider)) notFound()

  const { returnTo } = await searchParams
  // 쿼리스트링은 사용자가 조작할 수 있다. 그대로 리다이렉트하면 오픈 리다이렉트다
  const target = safeReturnTo(returnTo)
  const session = await readSession()

  if (session !== null) return <LoggedInNotice returnTo={target} />

  return (
    <>
      <AuthCardDog />
      <SocialSignupConsentScreen provider={provider} returnTo={target} />
    </>
  )
}
