'use client'

import { Button } from '@/components/button'
import { LoginDivider } from '@/features/auth/login-form'
import { SignupLoginPrompt } from '@/features/auth/signup-parts'
import { SocialLoginButtons } from '@/features/auth/social-login-buttons'
import type { OAuthProviderId } from '@/lib/auth/oauth-provider'
import { messages } from '@/lib/messages'

/** 진입 화면의 "이메일로 가입하기" — 이메일 단계에서 돌아오면 포커스가 여기로 온다 (`SignupScreen`) */
export const SIGNUP_WITH_EMAIL_ID = 'signup-with-email'

export type SignupMethodStepProps = {
  returnTo: string
  onSelectSocial: (provider: OAuthProviderId) => void
  onSelectEmail: () => void
}

/**
 * 회원가입 진입 — **가입 방법 고르기** (#1284 S1 · S2, 회원가입-세부명세 D14).
 *
 * 예전 첫 화면에는 동의 4줄 · 이메일 칸 · 흐린 소셜 버튼 · 로그인 링크가 한꺼번에 서 있었다. 여기는
 * 방법 셋과 출구 하나뿐이다. 동의는 방법을 고른 뒤 시트가 받는다(`SignupConsentSheet`).
 *
 * **소셜이 위다** — 로그인 화면(D13)과 같은 순서 · 같은 "또는" 구분이다. 소셜 버튼은 누르면 인가로
 * 가지 않고 고른 제공자만 알린다(`onSelect`) — 흐려 둘 이유가 없어 늘 눌린다.
 *
 * 소셜 문구는 `… 로그인` 그대로다(각 사 가이드, `socialLoginLabel` 주석). 미가입이면 서버가 그
 * 자리에서 가입시키므로 이 화면에서도 실제로 일어나는 일과 어긋나지 않는다.
 */
export function SignupMethodStep({
  returnTo,
  onSelectSocial,
  onSelectEmail,
}: SignupMethodStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-1 text-fg font-bold">{messages.auth.signupWelcomeTitle}</h1>
        <p className="text-body-2 text-fg-muted">{messages.auth.signupWelcomeDescription}</p>
      </div>
      <SocialLoginButtons returnTo={returnTo} onSelect={onSelectSocial} />
      <LoginDivider label={messages.auth.signupDivider} />
      <Button id={SIGNUP_WITH_EMAIL_ID} variant="secondary" size="lg" onClick={onSelectEmail}>
        {messages.auth.signupWithEmail}
      </Button>
      <SignupLoginPrompt returnTo={returnTo} />
    </div>
  )
}
