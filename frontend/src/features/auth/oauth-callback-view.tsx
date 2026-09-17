'use client'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { FormAlert } from '@/components/form-alert'
import { Skeleton } from '@/components/skeleton'
import { oauthNextAction } from '@/features/auth/oauth-error'
import { type OAuthExchangeState, useOAuthExchange } from '@/features/auth/use-oauth-exchange'
import { ApiError, classify } from '@/lib/api/error'
import { oauthProviderName } from '@/lib/auth/oauth-provider'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

const LOGIN_PATH = '/login'
/** 가입 동의를 실을 수 있는 유일한 입구 — 소셜 `/authorize` 호출 전이다 (#688) */
const SIGNUP_PATH = '/signup'

/**
 * 교환 상태별 화면. **상태를 갖지 않아 node 환경에서 렌더 테스트가 된다**
 * — docs/testing-guide.md §1, `LoginFormFields` 와 같은 분리다.
 *
 * **성공 상태가 없다.** 성공하면 곧바로 원래 가려던 곳으로 보내므로 그릴 것이 없다
 * (정본 D5). 성공 화면을 만들면 이동 전에 한 프레임 깜빡인다.
 *
 * 실패의 다음 행동은 셋 다 `/login` 이다. `code` 는 소모됐고 `state` 는 서버가 지웠으므로
 * **이 화면에서 재시도할 방법이 없다** — 이동이므로 버튼이 아니라 링크(`ButtonLink`)다.
 */
export function OAuthCallbackStatus({
  provider,
  exchange,
}: {
  provider: string
  exchange: OAuthExchangeState
}) {
  const providerName = oauthProviderName(provider)

  if (exchange.status === 'invalid') {
    return (
      <EmptyState
        title={messages.auth.oauthInvalidTitle}
        description={messages.auth.oauthInvalidDescription}
        action={<ButtonLink href={LOGIN_PATH}>{messages.auth.toLoginScreen}</ButtonLink>}
      />
    )
  }

  if (exchange.status === 'exchanging') {
    return (
      <div className="flex flex-col gap-3">
        {/*
          이 화면은 사용자의 조작 없이 저절로 바뀐다 — 시각적으로만 바뀌면 스크린리더
          사용자는 무슨 일이 일어나는지 알 수 없다 (정본 D6).
        */}
        <p role="status" className="text-body-1 text-fg font-semibold">
          {messages.auth.oauthExchanging}
        </p>
        <Skeleton />
        <Skeleton className="w-2/3" />
      </div>
    )
  }

  // 서버 문구를 그대로 쓴다. 없으면(무응답 등) 일시 장애 문구로 떨어진다
  const message =
    apiErrorToFormErrors(exchange.error, messages.common.temporaryErrorDescription).form ??
    messages.common.temporaryErrorDescription

  const status = exchange.error instanceof ApiError ? exchange.error.status : null
  const resultCode = exchange.error instanceof ApiError ? exchange.error.resultCode : null

  /*
    5xx·무응답은 우리가 고칠 수 있는 것이 없다 — 입력 오류처럼 보이지 않게 `FormAlert` 로
    짧게 알리고 로그인으로 돌려보낸다 (정본 D5 마지막 행).

    **`AUTH_014`(502, 제공자 통신 불가)도 여기로 온다.** `classify` 가 5xx 를 전부
    `'temporary'` 로 보기 때문인데, 그래도 문구는 서버 것(`message`)이라 "제공자와 통신할
    수 없다" 는 사유가 그대로 전달된다. 우리 일시 장애 문구로 덮이지 않는다.
  */
  if (status !== null && classify(status) === 'temporary') {
    return (
      <div className="flex flex-col items-start gap-3">
        <FormAlert message={message} />
        <ButtonLink href={LOGIN_PATH} variant="secondary">
          {messages.common.retry}
        </ButtonLink>
      </div>
    )
  }

  const action = oauthNextAction(resultCode)
  const label =
    action === 'consent' && providerName !== null
      ? messages.auth.socialRetryLabel(providerName)
      : action === 'signup-consent'
        ? messages.auth.toSignupConsent
        : action === 'signin'
          ? messages.auth.toLogin
          : messages.common.retry

  /*
    **동의 누락만 목적지가 다르다** (#688). 동의는 `/authorize` 를 부르기 **전에만**
    실을 수 있고(인가코드 1회용), 그 입구가 회원가입 화면의 동의 블록이다. 로그인
    화면으로 보내면 같은 실패를 그대로 반복한다 — 그쪽 소셜 버튼은 동의를 싣지 않는다.

    사유 문구는 여기서도 서버 것(`message`)을 그대로 쓴다. `MEMBER_010` 은 "이용약관과
    개인정보 처리방침에 동의해야", `MEMBER_011` 은 "만 14세 이상만" 이라고 이미 말한다.
  */
  const destination = action === 'signup-consent' ? SIGNUP_PATH : LOGIN_PATH

  return (
    <EmptyState
      title={messages.auth.oauthFailedTitle}
      description={message}
      action={<ButtonLink href={destination}>{label}</ButtonLink>}
    />
  )
}

/**
 * 소셜 로그인 콜백. 교환을 배선하고 화면은 `OAuthCallbackStatus` 에 맡긴다.
 *
 * 이 컴포넌트에는 분기가 없다 — 있으면 그만큼 렌더 테스트가 닿지 못한다.
 */
export function OAuthCallbackView({
  provider,
  code,
  state,
}: {
  provider: string
  code: string | null
  state: string | null
}) {
  const exchange = useOAuthExchange({ provider, code, state })

  return <OAuthCallbackStatus provider={provider} exchange={exchange} />
}
