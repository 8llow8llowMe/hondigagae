'use client'

import { useCallback, useState } from 'react'

import { SignupForm } from '@/features/auth/signup-form'
import { SocialLoginButtons } from '@/features/auth/social-login-buttons'
import {
  NO_SIGNUP_CONSENT,
  type SignupConsent,
  type SignupConsentKey,
} from '@/lib/auth/signup-consent'

/**
 * 회원가입 화면의 **동의 상태 소유자** — 이슈 #688.
 *
 * 이메일 가입(`POST /members/signup` 바디)과 소셜 최초 연동(`/authorize` 쿼리)이
 * **같은 동의 값을 쓴다.** 두 곳이 각자 체크박스를 들면 같은 화면에 같은 질문이 두 벌
 * 서고, 사용자는 어느 쪽을 켜야 하는지 알 수 없다.
 *
 * **동의를 서버 상태로 보지 않는다.** 아직 어디에도 저장되지 않은 입력값이라
 * React Query 가 아니라 화면 상태다 (architecture-guide.md §10).
 */
export function SignupScreen({ returnTo }: { returnTo: string }) {
  const [consent, setConsent] = useState<SignupConsent>(NO_SIGNUP_CONSENT)

  const handleConsentChange = useCallback((key: SignupConsentKey, checked: boolean) => {
    setConsent((previous) => ({ ...previous, [key]: checked }))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <SignupForm returnTo={returnTo} consent={consent} onConsentChange={handleConsentChange} />
      {/*
        소셜 로그인은 폼 아래에 둔다 — 기본 수단은 이메일 가입이다. `consent` 를 넘기는
        것이 곧 "여기는 가입 화면" 이라는 신호다: 로그인 화면은 넘기지 않아 동의 없이
        그대로 눌린다 (기존 회원 로그인은 동의와 무관하다).
      */}
      <SocialLoginButtons returnTo={returnTo} consent={consent} />
    </div>
  )
}
