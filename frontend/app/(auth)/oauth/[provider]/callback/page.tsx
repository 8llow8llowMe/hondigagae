import type { Metadata } from 'next'

import { OAuthCallbackView } from '@/features/auth/oauth-callback-view'
import { messages } from '@/lib/messages'

export const metadata: Metadata = { title: `${messages.auth.loginTitle} · 혼디가개` }

/**
 * 소셜 제공자가 돌려보내는 착지점. **우리 화면에서 링크로 오지 않는다.**
 * 보호 경로가 아니다 — 아직 로그인되지 않은 사람이 지나는 자리다 (정본 D0).
 *
 * `?code=a&code=b` 처럼 같은 키가 두 번 오면 Next 가 배열을 준다. 그런 요청은 제공자가
 * 만든 것이 아니므로 **문자열이 아니면 없는 것으로 본다** — 뷰가 "잘못된 접근" 으로 간다.
 */
function single(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null
}

export default async function OAuthCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>
  searchParams: Promise<{ code?: string | string[]; state?: string | string[] }>
}) {
  const { provider } = await params
  const { code, state } = await searchParams

  return <OAuthCallbackView provider={provider} code={single(code)} state={single(state)} />
}
