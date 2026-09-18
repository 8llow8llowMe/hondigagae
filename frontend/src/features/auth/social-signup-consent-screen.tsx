'use client'

import { useCallback, useState } from 'react'

import { SignupConsentFields } from '@/features/auth/signup-consent-fields'
import { SocialLoginButtons } from '@/features/auth/social-login-buttons'
import { type OAuthProviderId, oauthProviderName } from '@/lib/auth/oauth-provider'
import {
  NO_SIGNUP_CONSENT,
  type SignupConsent,
  type SignupConsentKey,
} from '@/lib/auth/signup-consent'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 소셜 최초 연동 전용 **동의 화면** — 이슈 #707.
 *
 * #688 은 동의 누락(`MEMBER_010` / `MEMBER_011`)으로 튕긴 사용자를 회원가입 화면으로
 * 보냈다. 계약상으로는 맞았다 — 동의를 실을 수 있는 자리가 `/authorize` 호출 전이고,
 * 그때 동의 체크박스를 들고 있는 화면이 회원가입 화면뿐이었다. **화면이 그 맥락을
 * 반영하지 못한 것이 문제였다**: 카카오에서 돌아온 사용자에게 이메일 입력(`필수` 표시가
 * 붙은)과 `3단계 중 1단계` 와 **네이버 버튼**까지 함께 보였다.
 *
 * 셋 중 네이버 버튼이 실제로 사고를 만든다. 동의를 켜고 바로 아래 네이버를 누르면 그것은
 * **다른 이메일의 다른 가입**이다. 그래서 이 화면은 **들어온 제공자 하나만** 그린다.
 *
 * **`/signup` 은 그대로 둔다.** 처음부터 회원가입 화면에 온 사용자에게 소셜 버튼 둘은
 * 여전히 "더 짧은 길" 안내다 (회원가입-세부명세 D8-3). 바뀐 것은 콜백에서 튕겨 돌아온
 * 사용자의 목적지뿐이다.
 *
 * **동의 상태 소유자다** — `SignupScreen` 과 같은 역할이다. 서버 컴포넌트인 페이지는
 * 상태를 들 수 없고, `SignupConsentFields` 는 일부러 상태를 갖지 않는다.
 */
export type SocialSignupConsentScreenProps = {
  /**
   * 경로 세그먼트를 **이미 검증한** 값이다. 페이지가 `isOAuthProvider` 로 거르고
   * 넘기므로 여기서는 표시 이름 조회가 실패할 일이 없다 (타입이 그것을 강제한다).
   */
  provider: OAuthProviderId
  returnTo: string
}

export function SocialSignupConsentScreen({ provider, returnTo }: SocialSignupConsentScreenProps) {
  const [consent, setConsent] = useState<SignupConsent>(NO_SIGNUP_CONSENT)

  const handleConsentChange = useCallback((key: SignupConsentKey, checked: boolean) => {
    setConsent((previous) => ({ ...previous, [key]: checked }))
  }, [])

  // 타입상 `null` 이 아니지만 `oauthProviderName` 의 계약은 `string | null` 이다
  const providerName = oauthProviderName(provider) ?? provider

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1 text-fg font-bold">{messages.auth.socialSignupConsentTitle}</h1>
        {/*
          **왜 제공자를 한 번 더 거치는지 말한다.** 인가코드는 1회용이고 `state` 는 서버가
          조회와 동시에 지우므로(Redis GETDEL) 방금 받은 것으로 재시도할 방법이 없다.
          다만 제공자 쪽 동의는 이미 끝나 있어 동의 화면 없이 곧장 돌아온다 — 이 말이
          없으면 사용자는 "또 처음부터" 로 읽고 이탈한다.
        */}
        <p className="text-body-2 text-fg-muted">
          {messages.auth.socialSignupConsentNotice(providerName)}
        </p>
      </div>

      {/*
        **오류를 받지 않는다.** 이 화면은 제출하지 않는다 — 거부는 `/authorize` 이후의
        콜백에서 일어나고 그 결과는 다시 콜백 화면이 그린다. 여기서 막는 것은 동의가 빈
        채로 나가는 것뿐이고, 그 안내는 `SocialLoginButtons` 가 이미 글자로 말한다.
      */}
      <SignupConsentFields
        consent={consent}
        errors={NO_FORM_ERRORS}
        onConsentChange={handleConsentChange}
      />

      {/*
        **들어온 제공자 하나만.** `consent` 를 넘기므로 셋 다 켜질 때까지 잠기고, 켜지면
        `/authorize` 쿼리에 실려 나간다 — 동의를 실을 수 있는 유일한 지점이다 (#688).
      */}
      <SocialLoginButtons returnTo={returnTo} consent={consent} providers={[provider]} />
    </div>
  )
}
