'use client'

import { Button, ButtonLink } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { FormNotice } from '@/components/form-notice'
import { Input } from '@/components/input'
import type { EmailValues, PasswordResetValues } from '@/features/auth/schemas'
import { classify } from '@/lib/api/error'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 비밀번호 찾기의 두 단계와 완료 화면. 전부 **상태 없는 표시 컴포넌트**다 —
 * `PasswordResetView` 가 상태·요청을 소유한다 (docs/testing-guide.md §1).
 *
 * 5xx·무응답만 `ErrorState` 로 위에 얹는다. **폼을 대체하지 않는다** — 갈아치우면
 * 이메일 오타를 고칠 수단이 사라진다 (`login-form.tsx` · `signup-steps.tsx` 와 같은 판단).
 * 429(`AUTH_003` 쿨다운 · `AUTH_016` IP 상한)는 `classify` 가 `'rate-limited'` 라
 * 여기 걸리지 않고 `FormAlert` 로만 보인다 — 재시도 버튼을 주면 상한만 더 소모한다.
 */

export type PasswordResetEmailStepProps = {
  values: EmailValues
  errors: FormErrors
  errorStatus: number | null
  submitting: boolean
  onValueChange: (key: keyof EmailValues, value: string) => void
  onSubmit: () => void
  onRetry: () => void
}

export function PasswordResetEmailStep({
  values,
  errors,
  errorStatus,
  submitting,
  onValueChange,
  onSubmit,
  onRetry,
}: PasswordResetEmailStepProps) {
  const isTemporaryError = errorStatus !== null && classify(errorStatus) === 'temporary'

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {isTemporaryError && (
        <ErrorState
          title={messages.common.temporaryErrorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
        />
      )}
      {/*
        `AUTH_005`(만료·미발급)·`AUTH_017`(5회 초과)로 되돌아온 사유도 여기로 온다.
        오류라서 `FormNotice`(role=status)가 아니라 `FormAlert`(role=alert)다
        — `signup-form.tsx` 의 stepBackMessage 와 같은 처리.
      */}
      <FormAlert message={errors.form} />

      <p className="text-body-2 text-fg-muted">{messages.auth.resetEmailDescription}</p>

      <Field id="email" label={messages.auth.emailLabel} error={errors.fields.email} required>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={values.email}
          onValueChange={(value) => onValueChange('email', value)}
          invalid={errors.fields.email !== undefined}
        />
      </Field>

      <Button type="submit" size="lg" loading={submitting} className="mt-2">
        {submitting ? messages.auth.resetSendingCode : messages.auth.resetSendCode}
      </Button>
    </form>
  )
}

export type PasswordResetCodeStepProps = {
  email: string
  values: PasswordResetValues
  errors: FormErrors
  errorStatus: number | null
  submitting: boolean
  cooldownSeconds: number
  /** 재발송이 인플라이트인가. 쿨다운과 별개로 이중 클릭을 막는다 (form-guide.md §6) */
  resending: boolean
  showPassword: boolean
  /** 발송 성공 안내. **이메일 존재 여부와 무관하게 늘 같은 문구다** (계정 열거 방지) */
  notice?: string | undefined
  onValueChange: (key: keyof PasswordResetValues, value: string) => void
  onTogglePassword: () => void
  onSubmit: () => void
  onResend: () => void
  onChangeEmail: () => void
  onRetry: () => void
}

export function PasswordResetCodeStep({
  email,
  values,
  errors,
  errorStatus,
  submitting,
  cooldownSeconds,
  resending,
  showPassword,
  notice,
  onValueChange,
  onTogglePassword,
  onSubmit,
  onResend,
  onChangeEmail,
  onRetry,
}: PasswordResetCodeStepProps) {
  const isTemporaryError = errorStatus !== null && classify(errorStatus) === 'temporary'

  const isCoolingDown = cooldownSeconds > 0
  // 매 초 갱신되는 카운트다운을 aria-live 에 그대로 실으면 초마다 읽힌다.
  // 보이는 초는 버튼 라벨(비-live)에 두고 알림은 10초 단위로만 낸다 — CodeStep 과 같은 처리
  const announceSeconds = isCoolingDown && cooldownSeconds % 10 === 0 ? cooldownSeconds : null

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {isTemporaryError && (
        <ErrorState
          title={messages.common.temporaryErrorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
        />
      )}
      <FormNotice message={notice ?? null} />
      <FormAlert message={errors.form} />
      {/* 이메일은 줄바꿈 기회가 없는 토큰이다 — 375px 폭에서 넘치지 않게 break-all */}
      <p className="text-body-2 text-fg-muted break-all">{email}</p>

      <Field id="code" label={messages.auth.codeLabel} error={errors.fields.code} required>
        <Input
          id="code"
          type="text"
          // 백엔드 예시가 A2B3C4D5 로 영숫자 혼합이다. numeric 이면 영문자를 못 넣는다 (D6)
          inputMode="text"
          autoComplete="one-time-code"
          value={values.code}
          onValueChange={(value) => onValueChange('code', value)}
          invalid={errors.fields.code !== undefined}
        />
      </Field>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isCoolingDown}
          loading={resending}
          onClick={onResend}
        >
          {isCoolingDown ? messages.auth.resendCooldown(cooldownSeconds) : messages.auth.resendCode}
        </Button>
        <span aria-live="polite" className="sr-only">
          {announceSeconds !== null ? messages.auth.resendCooldown(announceSeconds) : ''}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onChangeEmail}>
          {messages.auth.changeEmail}
        </Button>
      </div>

      {/*
        필드명이 `newPassword` 다 — 요청 DTO(`AuthPasswordResetRequest`)와 같아야
        서버 필드 오류(AUTH_106/107/108)가 이 입력에 붙는다.
      */}
      <Field
        id="newPassword"
        label={messages.auth.newPasswordLabel}
        error={errors.fields.newPassword}
        required
      >
        <div className="flex gap-2">
          <Input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={values.newPassword}
            onValueChange={(value) => onValueChange('newPassword', value)}
            invalid={errors.fields.newPassword !== undefined}
          />
          {/* 아이콘 자산이 없어 텍스트 버튼이다 — LoginFormFields 와 같은 이유 */}
          <Button
            variant="secondary"
            size="md"
            aria-pressed={showPassword}
            onClick={onTogglePassword}
          >
            {showPassword ? messages.auth.passwordHideShort : messages.auth.passwordShowShort}
          </Button>
        </div>
      </Field>

      <Button type="submit" size="lg" loading={submitting} className="mt-2">
        {submitting ? messages.auth.resetSubmitting : messages.auth.resetSubmit}
      </Button>
    </form>
  )
}

/**
 * 완료 화면.
 *
 * **자동으로 로그인 화면에 보내지 않는다.** 전 기기 로그아웃은 사용자가 예상하지 못한
 * 부수효과라(`jwtTokenStorePort.deleteAllSessions`) 읽을 시간을 줘야 한다 — 정본 D5.
 * 이메일을 미리 채워 넘기므로 이어지는 로그인은 비밀번호 한 번이다.
 *
 * **제목(`resetDoneTitle`)은 여기서 렌더하지 않는다.** `PasswordResetView` 의 단계 제목이
 * 이미 그 문구를 aria-live 영역으로 내보낸다 — 여기서 또 쓰면 같은 문장이 두 번 읽힌다.
 */
export function PasswordResetDone({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-body-2 text-fg-muted">{messages.auth.resetDoneDescription}</p>
      <ButtonLink
        href={`/login?${new URLSearchParams({ email }).toString()}`}
        size="lg"
        className="mt-2"
      >
        {messages.auth.toLoginScreen}
      </ButtonLink>
    </div>
  )
}
