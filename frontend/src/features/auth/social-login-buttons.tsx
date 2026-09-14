'use client'

import { type ReactNode, useRef, useState } from 'react'

import { Button, type ButtonVariant } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { KakaoMark, NaverMark } from '@/features/auth/provider-mark'
import { oauthAuthorize } from '@/lib/api/auth'
import { OAUTH_PROVIDERS, type OAuthProviderId, oauthProviderName } from '@/lib/auth/oauth-provider'
import { rememberReturnTo } from '@/lib/auth/oauth-return-to'
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
export function SocialLoginButtons({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState<string | null>(null)
  // 어느 버튼이 진행 중인지. 두 버튼에 같은 loading 을 걸면 누르지 않은 쪽도 도는 것처럼 보인다
  const [pending, setPending] = useState<string | null>(null)
  // disabled 반영 전 연속 클릭을 막는다 (form-guide.md §6) — 두 버튼을 번갈아 누르는 것도 막힌다
  const startingRef = useRef(false)

  const start = (provider: string) => {
    if (startingRef.current) return
    startingRef.current = true
    setPending(provider)
    setError(null)

    // 제공자로 나가기 **전에** 저장한다. 이동 후에는 우리 코드가 돌지 않는다
    rememberReturnTo(returnTo)

    void oauthAuthorize(provider)
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
            disabled={pending !== null && pending !== provider}
            onClick={() => start(provider)}
          >
            {messages.auth.socialLoginLabel(name)}
          </Button>
        )
      })}
    </div>
  )
}
