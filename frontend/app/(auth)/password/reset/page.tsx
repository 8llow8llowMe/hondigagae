import type { Metadata } from 'next'

import { PasswordResetView } from '@/features/auth/password-reset-view'
import { messages } from '@/lib/messages'

export const metadata: Metadata = { title: `${messages.auth.resetTitle} · 혼디가개` }

/**
 * 비밀번호 찾기. **로그인하지 못한 사람이 쓰는 화면이라 보호 경로가 아니다** —
 * `proxy.ts` 의 `PROTECTED_PATHS` 에 넣지 않는다 (정본 D0).
 *
 * `searchParams` 를 읽지 않는다. 이메일을 URL 에 싣지 않기 때문이다 (D3).
 */
export default function PasswordResetPage() {
  return <PasswordResetView />
}
