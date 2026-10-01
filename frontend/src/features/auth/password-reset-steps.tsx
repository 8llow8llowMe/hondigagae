'use client'

import Link from 'next/link'

import { Button, ButtonLink } from '@/components/button'
import { Field } from '@/components/field'
import { FormNotice } from '@/components/form-notice'
import { Input } from '@/components/input'
import { PasswordInput } from '@/components/password-input'
import { FormFailure } from '@/features/auth/form-failure'
import type { EmailValues, PasswordResetValues } from '@/features/auth/schemas'
import { VerificationCodeInput } from '@/features/auth/verification-code-input'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 비밀번호 찾기의 두 단계와 완료 화면. 전부 **상태 없는 표시 컴포넌트**다 —
 * `PasswordResetView` 가 상태·요청을 소유한다 (docs/testing-guide.md §1).
 *
 * 폼 전체 실패는 `FormFailure` 한 자리다 (#1079) — 5xx·무응답이면 폼 안 일시 장애(재시도
 * 있음), 그 밖은 `FormAlert` 로 **둘 중 하나만** 선다. **폼을 대체하지 않는다** — 갈아치우면
 * 이메일 오타를 고칠 수단이 사라진다 (`login-form.tsx` · `signup-steps.tsx` 와 같은 판단).
 * 429(`AUTH_003` 쿨다운 · `AUTH_016` IP 상한)는 `classify` 가 `'rate-limited'` 라
 * 일시 장애가 아니고 `FormAlert` 로만 보인다 — 재시도 버튼을 주면 상한만 더 소모한다.
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
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {/*
        `AUTH_005`(만료·미발급)·`AUTH_017`(5회 초과)로 되돌아온 사유도 여기로 온다.
        오류라서 `FormNotice`(role=status)가 아니라 `FormAlert`(role=alert)다
        — `signup-form.tsx` 의 stepBackMessage 와 같은 처리.
      */}
      <FormFailure
        message={errors.form}
        errorStatus={errorStatus}
        submitting={submitting}
        onRetry={onRetry}
      />

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
  /** 발송 성공 안내. **이메일 존재 여부와 무관하게 늘 같은 문구다** (계정 열거 방지) */
  notice?: string | undefined
  onValueChange: (key: keyof PasswordResetValues, value: string) => void
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
  notice,
  onValueChange,
  onSubmit,
  onResend,
  onChangeEmail,
  onRetry,
}: PasswordResetCodeStepProps) {
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
      <FormNotice message={notice ?? null} />
      <FormFailure
        message={errors.form}
        errorStatus={errorStatus}
        // 재발송도 새 요청이다 — 그 결과를 기다리는 동안 직전 실패를 세워 두지 않는다 (#1084)
        submitting={submitting || resending}
        onRetry={onRetry}
      />
      {/* 이메일은 줄바꿈 기회가 없는 토큰이다 — 375px 폭에서 넘치지 않게 break-all */}
      <p className="text-body-2 text-fg-muted break-all">{email}</p>

      <Field id="code" label={messages.auth.codeLabel} error={errors.fields.code} required>
        {/* 입력 중에 대문자화 · 공백 제거 — 가입 2단계와 같은 칸이다 (#1078) */}
        <VerificationCodeInput
          id="code"
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
        hint={messages.form.passwordRule}
        required
      >
        {/* 입력란 안 눈 토글 — 가입 3단계 · 마이페이지와 같은 `PasswordInput` 이다 (#1080) */}
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          value={values.newPassword}
          onValueChange={(value) => onValueChange('newPassword', value)}
          invalid={errors.fields.newPassword !== undefined}
        />
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
    <div className="flex flex-col items-start">
      <ButtonLink href={`/login?${new URLSearchParams({ email }).toString()}`} size="lg">
        {messages.auth.toLoginScreen}
      </ButtonLink>
    </div>
  )
}

export type PasswordResetHeadingProps = {
  /** 지금 단계의 제목 — "가입한 이메일을 알려주세요" 등 */
  heading: string
  /** 제목 바로 아래 설명 줄. 없는 단계(2단계)는 넘기지 않는다 */
  description?: string | undefined
}

/**
 * 단계 제목 + 설명 줄 (#1084 L3).
 *
 * **둘을 한 묶음으로 둔다 — 사이는 4 다** (DESIGN.md §4 "제목 아래 캡션/설명 줄"). 예전에는
 * 제목이 화면 쪽(`gap-6`)에, 설명이 폼 안에 따로 있어 그 사이에 24 가 벌어졌고, 실패 알림이
 * 서면 알림이 **제목과 설명 사이에** 끼었다. 완료 화면의 전 기기 로그아웃 안내도 같은 이유로
 * 여기로 왔다 — `PasswordResetDone` 은 이제 이동 버튼 하나다.
 *
 * **live 영역은 묶음 전체다.** 단계는 시각적으로만 바뀌어 스크린리더에는 아무 일도 없는 것과
 * 같으므로 제목을 알린다(정본 D6). 설명까지 넣는 이유는 완료 화면이다: 포커스가 "로그인으로"
 * 버튼으로 옮겨 가 "모든 기기에서 로그아웃했어요" 가 예전에는 읽히지 않았다.
 */
export function PasswordResetHeading({ heading, description }: PasswordResetHeadingProps) {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      <p className="text-body-1 text-fg font-semibold">{heading}</p>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
    </div>
  )
}

/**
 * 1 · 2단계 아래 "로그인으로" (#1084 L3, 정본 D4).
 *
 * 비밀번호가 기억난 사람이나 잘못 들어온 사람에게 **브라우저 뒤로 가기 말고는 길이 없었다.**
 * 완료 화면에는 그리지 않는다 — 그 화면의 주 행동이 같은 목적지의 버튼이라 두 번 말하게 된다.
 *
 * **쿼리를 싣지 않는다.** 이메일은 URL 에 올리지 않고(D3, 예외는 완료 뒤 1회 이동뿐),
 * `returnTo` 는 재설정이 처음부터 이어받지 않는다(로그인-세부명세 D10).
 *
 * 누르는 자리는 `min-h-11` 로 44 다 — 로그인 화면의 "비밀번호 찾기" 와 같은 모양이다.
 */
export function PasswordResetLoginLink() {
  return (
    <p className="flex justify-center">
      <Link
        href="/login"
        className="text-body-2 text-fg-muted inline-flex min-h-11 items-center px-1 underline"
      >
        {messages.auth.toLoginScreen}
      </Link>
    </p>
  )
}
