'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { AuthTopBar } from '@/features/auth/auth-top-bar'
import { SignupConsentSheet } from '@/features/auth/signup-consent-sheet'
import { SignupForm } from '@/features/auth/signup-form'
import { SIGNUP_WITH_EMAIL_ID, SignupMethodStep } from '@/features/auth/signup-method-step'
import { SocialLoginButtons } from '@/features/auth/social-login-buttons'
import type { OAuthProviderId } from '@/lib/auth/oauth-provider'
import {
  NO_SIGNUP_CONSENT,
  setAllSignupConsent,
  type SignupConsent,
  type SignupConsentKey,
} from '@/lib/auth/signup-consent'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

type Phase = 'method' | 'email'

/**
 * 회원가입 화면의 **동의 상태 소유자** — 이슈 #688 · #1284.
 *
 * 이메일 가입(`POST /members/signup` 바디)과 소셜 최초 연동(`/authorize` 쿼리)이
 * **같은 동의 값을 쓴다.** 소셜 시트에서 켜고 닫은 뒤 이메일로 가도 켠 항목이 남는다.
 *
 * **동의를 서버 상태로 보지 않는다.** 아직 어디에도 저장되지 않은 입력값이라
 * React Query 가 아니라 화면 상태다 (architecture-guide.md §10).
 *
 * **두 국면을 가른다** (#1284, 회원가입-세부명세 D14) — 가입 방법 고르기(`method`) → 이메일 가입
 * 3단계(`email`, `SignupForm`). 국면은 URL 에 두지 않는다: 이메일 단계는 서버 인증 상태와 묶여
 * 새로고침하면 어차피 처음으로 돌아가고(D3), 주소로 중간에 들어올 수 있으면 안 된다.
 */
export function SignupScreen({ returnTo, notice }: { returnTo: string; notice?: ReactNode }) {
  const [consent, setConsent] = useState<SignupConsent>(NO_SIGNUP_CONSENT)
  const [phase, setPhase] = useState<Phase>('method')
  // 약관 시트를 띄운 소셜 제공자. 시트 안에서 그 제공자 하나만 인가를 시작한다
  const [socialProvider, setSocialProvider] = useState<OAuthProviderId | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleConsentChange = useCallback((key: SignupConsentKey, checked: boolean) => {
    setConsent((previous) => ({ ...previous, [key]: checked }))
  }, [])

  const handleConsentAllChange = useCallback((checked: boolean) => {
    setConsent(setAllSignupConsent(checked))
  }, [])

  /*
    **이메일 단계에서 돌아오면 "이메일로 가입하기" 로 포커스를 돌려준다.** 국면이 바뀌면 누른 버튼이
    통째로 사라져 포커스가 `BODY` 로 떨어진다 — 키보드 사용자가 문서 맨 위에서 다시 시작한다.
    첫 마운트(StrictMode 재호출 포함)는 건드리지 않는다 — 직전 국면과 실제로 달라졌을 때만.
  */
  const previousPhaseRef = useRef<Phase>(phase)
  useEffect(() => {
    if (previousPhaseRef.current === phase) return
    previousPhaseRef.current = phase
    if (phase === 'method') {
      containerRef.current?.querySelector<HTMLElement>(`#${SIGNUP_WITH_EMAIL_ID}`)?.focus()
    }
  }, [phase])

  if (phase === 'email') {
    return (
      <div ref={containerRef}>
        <SignupForm
          returnTo={returnTo}
          consent={consent}
          onConsentChange={handleConsentChange}
          onConsentAllChange={handleConsentAllChange}
          onExit={() => setPhase('method')}
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {/* 하위 화면의 출구 (#1283 C3). `returnTo` 를 물고 돌아간다 — 들어온 맥락을 잃지 않게 */}
      <AuthTopBar
        back={{ href: `/login?${new URLSearchParams({ returnTo }).toString()}` }}
        backLabel={messages.auth.backToLogin}
      />
      {notice}
      <SignupMethodStep
        returnTo={returnTo}
        onSelectSocial={setSocialProvider}
        onSelectEmail={() => setPhase('email')}
      />
      {/*
        **오류를 받지 않는다** — 소셜 쪽 동의 거부는 `/authorize` 뒤 콜백에서 일어나고 그 결과는 콜백
        화면이 그린다(#707 동의 화면과 같은 판단). 시트 안 버튼은 셋 다 켜질 때까지 잠긴다.
      */}
      <SignupConsentSheet
        open={socialProvider !== null}
        onClose={() => setSocialProvider(null)}
        consent={consent}
        errors={NO_FORM_ERRORS}
        onConsentChange={handleConsentChange}
        onConsentAllChange={handleConsentAllChange}
        action={
          socialProvider !== null && (
            <SocialLoginButtons
              returnTo={returnTo}
              consent={consent}
              providers={[socialProvider]}
            />
          )
        }
      />
    </div>
  )
}
