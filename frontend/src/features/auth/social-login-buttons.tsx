'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { oauthAuthorize } from '@/lib/api/auth'
import { OAUTH_PROVIDERS, oauthProviderName } from '@/lib/auth/oauth-provider'
import { rememberReturnTo } from '@/lib/auth/oauth-return-to'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 소셜 로그인 진입점. 로그인·회원가입 두 화면에 붙는다 — 미가입 이메일이면 서버가
 * 자동으로 가입시키므로 **두 화면에서 결과가 같다** (정본 D8-3).
 *
 * **서버가 리다이렉트를 대신 해주지 않는다.** `authorize` 는 URL 을 돌려줄 뿐이고,
 * 그 주소로 이동하는 것은 우리다 (정본 D1). `router.push` 가 아니라
 * `location.assign` 인 이유는 목적지가 외부 오리진(제공자 인가 페이지)이라 Next 라우터가
 * 다룰 수 없기 때문이다.
 *
 * 로고 대신 텍스트 버튼이다. 각 사 브랜드 가이드라인을 지킨 로고 자산을 확보하기 전까지의
 * 상태이고(정본 D8-1), 어느 쪽이든 **제공자 이름은 텍스트로 남는다** (D6).
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
        return (
          <Button
            key={provider}
            variant="secondary"
            size="lg"
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
