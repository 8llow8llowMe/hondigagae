import Link from 'next/link'

import { Button } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import type { CodeValues, EmailValues, SignupProfileValues } from '@/features/auth/schemas'
import { classify } from '@/lib/api/error'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 세 단계 전부 **상태 없는 표시 컴포넌트**다. `SignupForm` 이 상태·요청을 소유한다.
 * 상태를 가진 컴포넌트는 node 테스트 환경에서 렌더되지 않는다
 * — docs/testing-guide.md §1, 로그인 화면의 `LoginFormFields` 와 같은 구조.
 *
 * 5xx·무응답은 `errorStatus` 로 구분해 `ErrorState` 로 대체 렌더한다. 429(쿨다운·잠금)는
 * `classify` 가 `'rate-limited'` 로 분류해 여기 걸리지 않는다 — `FormAlert` 로만 보여준다.
 * `LoginFormFields` 가 이미 세운 패턴이다.
 */

export type EmailStepProps = {
  values: EmailValues
  errors: FormErrors
  errorStatus: number | null
  isSubmitting: boolean
  onValueChange: (key: keyof EmailValues, value: string) => void
  onSubmit: () => void
  onRetry: () => void
}

export function EmailStep({
  values,
  errors,
  errorStatus,
  isSubmitting,
  onValueChange,
  onSubmit,
  onRetry,
}: EmailStepProps) {
  if (errorStatus !== null && classify(errorStatus) === 'temporary') {
    return (
      <ErrorState
        title={messages.common.temporaryErrorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {/* 단계 표시는 텍스트로도 읽힌다 — 색·아이콘만으로 표현하지 않는다 (D6) */}
      <p className="text-caption text-fg-muted">{messages.auth.stepOf(1, 3)}</p>
      <FormAlert message={errors.form} />

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

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
        {isSubmitting ? messages.auth.sendingCode : messages.auth.sendCode}
      </Button>
    </form>
  )
}

export type CodeStepProps = {
  email: string
  values: CodeValues
  errors: FormErrors
  errorStatus: number | null
  isSubmitting: boolean
  cooldownSeconds: number
  onValueChange: (key: keyof CodeValues, value: string) => void
  onSubmit: () => void
  onResend: () => void
  onChangeEmail: () => void
  onRetry: () => void
}

export function CodeStep({
  email,
  values,
  errors,
  errorStatus,
  isSubmitting,
  cooldownSeconds,
  onValueChange,
  onSubmit,
  onResend,
  onChangeEmail,
  onRetry,
}: CodeStepProps) {
  if (errorStatus !== null && classify(errorStatus) === 'temporary') {
    return (
      <ErrorState
        title={messages.common.temporaryErrorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  const isCoolingDown = cooldownSeconds > 0
  // 매 초 갱신되는 카운트다운을 그대로 aria-live 에 실으면 초마다 읽힌다.
  // 화면에 보이는 초는 버튼 라벨(비-live)에 두고, 스크린리더 알림은 10초 단위로만 낸다 (D6)
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
      <p className="text-caption text-fg-muted">{messages.auth.stepOf(2, 3)}</p>
      <FormAlert message={errors.form} />
      <p className="text-body-2 text-fg-muted">{email}</p>

      <Field id="code" label={messages.auth.codeLabel} error={errors.fields.code} required>
        <Input
          id="code"
          type="text"
          // 백엔드 예시가 A3K7MP2X 로 영숫자 혼합이다. numeric 이면 영문자를 못 넣는다 (D6)
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

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
        {isSubmitting ? messages.auth.verifyingCode : messages.auth.verifyCode}
      </Button>
    </form>
  )
}

export type ProfileStepProps = {
  values: SignupProfileValues
  errors: FormErrors
  errorStatus: number | null
  isSubmitting: boolean
  /** 409(MEMBER_001)로 확인된 이메일. null 이면 중복 안내를 렌더하지 않는다 */
  duplicateEmail: string | null
  /** 로그인 링크에 실을 복귀 경로 */
  returnTo: string
  onValueChange: (key: keyof SignupProfileValues, value: string) => void
  onSubmit: () => void
  onRetry: () => void
}

export function ProfileStep({
  values,
  errors,
  errorStatus,
  isSubmitting,
  duplicateEmail,
  returnTo,
  onValueChange,
  onSubmit,
  onRetry,
}: ProfileStepProps) {
  if (errorStatus !== null && classify(errorStatus) === 'temporary') {
    return (
      <ErrorState
        title={messages.common.temporaryErrorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={onRetry}
      />
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <p className="text-caption text-fg-muted">{messages.auth.stepOf(3, 3)}</p>
      <FormAlert message={errors.form} />

      {duplicateEmail !== null && (
        <Link
          href={`/login?${new URLSearchParams({ returnTo, email: duplicateEmail }).toString()}`}
          className="text-body-2 text-brand-600 underline"
        >
          {messages.auth.toLogin}
        </Link>
      )}

      <Field
        id="password"
        label={messages.auth.passwordLabel}
        error={errors.fields.password}
        required
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onValueChange={(value) => onValueChange('password', value)}
          invalid={errors.fields.password !== undefined}
        />
      </Field>

      <Field id="name" label={messages.auth.nameLabel} error={errors.fields.name} required>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          value={values.name}
          onValueChange={(value) => onValueChange('name', value)}
          invalid={errors.fields.name !== undefined}
        />
      </Field>

      <Field
        id="nickname"
        label={messages.auth.nicknameLabel}
        error={errors.fields.nickname}
        required
      >
        <Input
          id="nickname"
          type="text"
          autoComplete="nickname"
          value={values.nickname}
          onValueChange={(value) => onValueChange('nickname', value)}
          invalid={errors.fields.nickname !== undefined}
        />
      </Field>

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
        {isSubmitting ? messages.auth.signingUp : messages.auth.signupSubmit}
      </Button>
    </form>
  )
}
