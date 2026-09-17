'use client'

import { type ReactNode, useRef, useState } from 'react'

import { Button, type ButtonVariant } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { KakaoMark, NaverMark } from '@/features/auth/provider-mark'
import { oauthAuthorize } from '@/lib/api/auth'
import { OAUTH_PROVIDERS, type OAuthProviderId, oauthProviderName } from '@/lib/auth/oauth-provider'
import { rememberReturnTo } from '@/lib/auth/oauth-return-to'
import { isSignupConsentComplete, type SignupConsent } from '@/lib/auth/signup-consent'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 제공자별 외형. **두 축(변형 · 마크)만 갈린다** — 높이·곡률·글자 크기는 갈리지 않는다.
 *
 * 각 사 가이드는 자기 버튼의 절대 크기를 다르게 정해 두었지만(카카오 45 · 네이버 54),
 * 두 버튼은 **한 화면에 세로로 나란히 선다.** 그 자리에서 높이가 갈리면 가이드를 지킨
 * 대가로 우리 화면이 어긋나므로 크기는 `Button` 의 `lg`(48) 하나로 묶는다 — 각 사
 * 가이드가 실제로 고정하는 것은 **색과 마크와 문구**이고, 높이는 그 셋이 아니다.
 *
 * `Record<OAuthProviderId, …>` 라 제공자를 늘리면 **여기 누락을 타입체커가 잡는다**
 * (component-guide.md §2).
 */
const PROVIDER_BRAND: Record<OAuthProviderId, { variant: ButtonVariant; mark: ReactNode }> = {
  kakao: { variant: 'kakao', mark: <KakaoMark /> },
  // 흰 배경 변형이다 — 초록 채움은 2.25:1 로 AA 미달 (DESIGN.md §2-8, NaverMark 주석)
  naver: { variant: 'secondary', mark: <NaverMark /> },
}

/**
 * 소셜 로그인 진입점. 로그인·회원가입 두 화면에 붙는다 — 미가입 이메일이면 서버가
 * 자동으로 가입시키므로 **두 화면에서 결과가 같다** (정본 D8-3).
 *
 * **서버가 리다이렉트를 대신 해주지 않는다.** `authorize` 는 URL 을 돌려줄 뿐이고,
 * 그 주소로 이동하는 것은 우리다 (정본 D1). `router.push` 가 아니라
 * `location.assign` 인 이유는 목적지가 외부 오리진(제공자 인가 페이지)이라 Next 라우터가
 * 다룰 수 없기 때문이다.
 *
 * **각 사 공식 마크를 단다** — 정본 D8-1 이 "자산이 없어 ①텍스트 버튼으로 머지했다,
 * ②공식 로고는 후속 이슈" 로 남긴 것을 여기서 닫는다. 자산은 Figma
 * `카카오 네이버 로그인 디자인 가이드 (Community)` 에서 받았다 (`provider-mark.tsx`).
 * **마크를 달아도 제공자 이름은 텍스트로 남는다** (D6: "로고만 두지 않는다").
 */
export type SocialLoginButtonsProps = {
  returnTo: string
  /**
   * 가입 화면에서만 넘긴다 — 이슈 #688.
   *
   * **넘기면 "가입 입구" 로 동작한다**: 셋 다 켜질 때까지 버튼을 잠그고, 켜지면
   * `/authorize` 쿼리에 실어 보낸다. 최초 연동(= 신규 가입)에서만 쓰이는 값이라
   * 기존 회원의 로그인은 영향받지 않는다.
   *
   * **로그인 화면은 넘기지 않는다.** 그쪽은 이미 가입한 회원의 입구라 동의를 물을
   * 이유가 없다. 신규 사용자가 거기서 눌러 최초 연동이 되면 콜백이 `MEMBER_010` /
   * `MEMBER_011` 로 거부하고, `OAuthCallbackStatus` 가 회원가입 화면으로 안내한다.
   */
  consent?: SignupConsent | undefined
}

export function SocialLoginButtons({ returnTo, consent }: SocialLoginButtonsProps) {
  const [error, setError] = useState<string | null>(null)
  // 어느 버튼이 진행 중인지. 두 버튼에 같은 loading 을 걸면 누르지 않은 쪽도 도는 것처럼 보인다
  const [pending, setPending] = useState<string | null>(null)
  // disabled 반영 전 연속 클릭을 막는다 (form-guide.md §6) — 두 버튼을 번갈아 누르는 것도 막힌다
  const startingRef = useRef(false)

  /*
    **동의를 안 받았으면 아예 부르지 않는다.** `/authorize` 는 동의가 비어도 성공하고,
    거부는 인가코드를 태운 뒤인 콜백에서 일어난다 — 그 코드는 1회용이라 사용자가
    제공자 인가 화면부터 다시 밟아야 한다. 여기서 막는 것이 유일하게 되돌릴 수 있는
    지점이다 (#688).
  */
  const consentBlocked = consent !== undefined && !isSignupConsentComplete(consent)

  const start = (provider: string) => {
    if (startingRef.current || consentBlocked) return
    startingRef.current = true
    setPending(provider)
    setError(null)

    // 제공자로 나가기 **전에** 저장한다. 이동 후에는 우리 코드가 돌지 않는다
    rememberReturnTo(returnTo)

    void oauthAuthorize(provider, consent)
      .then((result) => {
        globalThis.location.assign(result.authorizationUrl)
      })
      .catch((unknownError: unknown) => {
        setError(apiErrorToFormErrors(unknownError, messages.form.submitFailed).form)
        startingRef.current = false
        setPending(null)
      })
    // 성공 경로에서는 가드를 풀지 않는다 — 이동이 시작된 뒤 다시 누를 수 있으면 안 된다
  }

  return (
    <div className="flex flex-col gap-3">
      <FormAlert message={error} />
      {/*
        **버튼만 흐리게 두지 않는다.** 왜 못 누르는지 보이지 않으면 사용자는 고장으로
        읽는다. `role` 을 붙이지 않는 것은 이것이 오류가 아니라 상시 안내라서다 —
        체크박스를 켜면 조용히 사라진다.
      */}
      {consentBlocked && (
        <p className="text-caption text-fg-muted">{messages.auth.socialConsentRequired}</p>
      )}
      {OAUTH_PROVIDERS.map((provider) => {
        const name = oauthProviderName(provider) ?? provider
        const brand = PROVIDER_BRAND[provider]
        return (
          <Button
            key={provider}
            variant={brand.variant}
            size="lg"
            /*
              `loading` 이면 `Button` 이 스스로 `disabled` + `aria-busy` 를 켠다. 마크는
              그대로 둔다 — 누른 버튼에서 마크가 사라지면 "어느 쪽을 눌렀는지" 를 잃는다.
            */
            leading={brand.mark}
            loading={pending === provider}
            disabled={consentBlocked || (pending !== null && pending !== provider)}
            onClick={() => start(provider)}
          >
            {messages.auth.socialLoginLabel(name)}
          </Button>
        )
      })}
    </div>
  )
}
