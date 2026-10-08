'use client'

import Link from 'next/link'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { FormFailure } from '@/components/form-failure'
import { FormNotice } from '@/components/form-notice'
import { Input } from '@/components/input'
import { PasswordInput } from '@/components/password-input'
import type { CodeValues, EmailValues, SignupProfileValues } from '@/features/auth/schemas'
import { SignupEmailSummary } from '@/features/auth/signup-parts'
import { VerificationCodeInput } from '@/features/auth/verification-code-input'
import { handOffLoginEmail } from '@/lib/auth/login-email-handoff'
import type { FormErrors } from '@/lib/form/field-errors'
import { type FailureAnnounce, submitFailureAnnounce } from '@/lib/form/submit-failure-focus'
import { messages } from '@/lib/messages'

/**
 * 세 단계 전부 **상태 없는 표시 컴포넌트**다. `SignupForm` 이 상태·요청을 소유한다.
 * 상태를 가진 컴포넌트는 node 테스트 환경에서 렌더되지 않는다
 * — docs/testing-guide.md §1, 로그인 화면의 `LoginFormFields` 와 같은 구조.
 *
 * 폼 전체 실패는 `FormFailure` 한 자리다 (#1079). 5xx·무응답은 `errorStatus` 로 구분해 폼 안
 * 일시 장애(재시도 있음)를, 그 밖은 `FormAlert` 를 — **둘 중 하나만** 그린다. 429(쿨다운·잠금)는
 * `classify` 가 `'rate-limited'` 로 분류해 일시 장애가 아니다 — `FormAlert` 로만 보여준다.
 * `LoginFormFields` 와 같은 자리다.
 *
 * **단계 표시는 여기 없다** (#1083). 제목 바로 아래 — 화면 단위 동의 블록보다 위 — 에
 * 서야 해서 `SignupStepHeading`(`signup-parts.tsx`)이 그린다.
 */

export type EmailStepProps = {
  values: EmailValues
  errors: FormErrors
  errorStatus: number | null
  submitting: boolean
  /**
   * 폼 전체 실패가 무엇으로 읽히는가 (#1102). 생략하면 포커스 순서의 첫 대상으로 정한다
   * (`submitFailureAnnounce`). 되돌림 안내처럼 포커스를 이메일 칸으로 보내는 갈래는 `SignupForm`
   * 이 `live` 를 넘긴다.
   */
  announce?: FailureAnnounce | undefined
  onValueChange: (key: keyof EmailValues, value: string) => void
  onSubmit: () => void
  onRetry: () => void
}

export function EmailStep({
  values,
  errors,
  errorStatus,
  submitting,
  announce = submitFailureAnnounce(errors, errorStatus),
  onValueChange,
  onSubmit,
  onRetry,
}: EmailStepProps) {
  // **폼을 대체하지 않고 위에 얹는다.** early return 으로 폼을 통째로 갈아치우면
  // 명세의 "단계·입력값 유지"(회원가입-세부명세.md D4)를 어긴다 — 이슈 #24 최종
  // 리뷰 I1 재수정. login-form.tsx 의 LoginFormFields 와 같은 패턴.
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FormFailure
        message={errors.form}
        errorStatus={errorStatus}
        submitting={submitting}
        announce={announce}
        onRetry={onRetry}
      />

      {/* 칸 하나뿐인 폼의 `*` 는 정보가 없다 — 로그인 · 재설정과 같은 규칙 (#1283 C5 → #1284) */}
      <Field id="email" label={messages.auth.emailLabel} error={errors.fields.email}>
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
        {submitting ? messages.auth.sendingCode : messages.auth.sendCode}
      </Button>
    </form>
  )
}

export type CodeStepProps = {
  email: string
  values: CodeValues
  errors: FormErrors
  errorStatus: number | null
  submitting: boolean
  cooldownSeconds: number
  /** 재전송 요청이 인플라이트인가. 쿨다운과 별개로 이중 클릭을 막는다 (form-guide.md §6) */
  resending: boolean
  /** 1단계 성공 안내("메일로 인증코드를 보냈어요."). 없으면 렌더하지 않는다 */
  notice?: string | undefined
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
  submitting,
  cooldownSeconds,
  resending,
  notice,
  onValueChange,
  onSubmit,
  onResend,
  onChangeEmail,
  onRetry,
}: CodeStepProps) {
  // **폼을 대체하지 않고 위에 얹는다.** early return 으로 폼을 통째로 갈아치우면
  // 명세의 "단계·입력값 유지"(회원가입-세부명세.md D4)를 어긴다 — 이슈 #24 최종
  // 리뷰 I1 재수정. login-form.tsx 의 LoginFormFields 와 같은 패턴.
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
      <SignupEmailSummary label={messages.auth.codeRecipientLabel} email={email} />
      <FormNotice message={notice ?? null} />
      <FormFailure
        message={errors.form}
        errorStatus={errorStatus}
        // 재발송도 새 요청이다 — 그 결과를 기다리는 동안 직전 실패를 세워 두지 않는다 (#1084)
        submitting={submitting || resending}
        // 제출 · 재전송 실패 뒤 포커스와 같은 판정이다 (#1102, `resendFocusTargets`)
        announce={submitFailureAnnounce(errors, errorStatus)}
        onRetry={onRetry}
      />

      {/* 칸 하나뿐인 단계라 `*` 를 달지 않는다 (#1284) */}
      <Field id="code" label={messages.auth.codeLabel} error={errors.fields.code}>
        {/* 입력 중에 대문자화 · 공백 제거 — 재설정 2단계와 같은 칸이다 (#1078) */}
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

      <Button type="submit" size="lg" loading={submitting} className="mt-2">
        {submitting ? messages.auth.verifyingCode : messages.auth.verifyCode}
      </Button>
    </form>
  )
}

export type ProfileStepProps = {
  /** 2단계에서 인증을 마친 이메일. 이 단계에서는 고칠 수 없어 값으로만 보인다 (#1083) */
  email: string
  values: SignupProfileValues
  errors: FormErrors
  errorStatus: number | null
  submitting: boolean
  /** 409(MEMBER_001)로 확인된 이메일. null 이면 중복 안내를 렌더하지 않는다 */
  duplicateEmail: string | null
  /** 로그인 링크에 실을 복귀 경로 */
  returnTo: string
  /** 2단계 성공 안내("이메일 인증이 완료됐어요."). 없으면 렌더하지 않는다 */
  notice?: string | undefined
  onValueChange: (key: keyof SignupProfileValues, value: string) => void
  onSubmit: () => void
  onRetry: () => void
}

export function ProfileStep({
  email,
  values,
  errors,
  errorStatus,
  submitting,
  duplicateEmail,
  returnTo,
  notice,
  onValueChange,
  onSubmit,
  onRetry,
}: ProfileStepProps) {
  // **폼을 대체하지 않고 위에 얹는다.** early return 으로 폼을 통째로 갈아치우면
  // 명세의 "단계·입력값 유지"(회원가입-세부명세.md D4)를 어긴다 — 이슈 #24 최종
  // 리뷰 I1 재수정. login-form.tsx 의 LoginFormFields 와 같은 패턴.
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <SignupEmailSummary label={messages.auth.signupEmailLabel} email={email} />
      <FormNotice message={notice ?? null} />
      <FormFailure
        message={errors.form}
        errorStatus={errorStatus}
        submitting={submitting}
        announce={submitFailureAnnounce(errors, errorStatus)}
        onRetry={onRetry}
      />

      {duplicateEmail !== null && (
        <Link
          href={`/login?${new URLSearchParams({ returnTo }).toString()}`}
          // 이메일은 URL 이 아니라 넘겨주기로 간다 — 기록 · 로그 · Referer 에 남지 않게 (#1158)
          onClick={() => handOffLoginEmail(duplicateEmail)}
          className="text-body-2 text-brand-600 underline"
        >
          {messages.auth.toLogin}
        </Link>
      )}

      {/*
        **세 칸 다 필수라 `*` 를 달지 않는다** (#1284) — 전부 필수인 폼의 `*` 는 정보가 없다.
        규칙은 **틀리기 전에** 보인다 (#1080) — 오류가 서면 그 자리를 오류가 대신한다.
        비밀번호 확인 칸은 두지 않는다. 눈 토글로 친 값을 직접 보고 고친다 (회원가입-세부명세 D6).
      */}
      <Field
        id="password"
        label={messages.auth.passwordLabel}
        error={errors.fields.password}
        hint={messages.form.passwordRule}
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={values.password}
          onValueChange={(value) => onValueChange('password', value)}
          invalid={errors.fields.password !== undefined}
        />
      </Field>

      <Field id="name" label={messages.auth.nameLabel} error={errors.fields.name}>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          value={values.name}
          onValueChange={(value) => onValueChange('name', value)}
          invalid={errors.fields.name !== undefined}
        />
      </Field>

      <Field id="nickname" label={messages.auth.nicknameLabel} error={errors.fields.nickname}>
        <Input
          id="nickname"
          type="text"
          autoComplete="nickname"
          value={values.nickname}
          onValueChange={(value) => onValueChange('nickname', value)}
          invalid={errors.fields.nickname !== undefined}
        />
      </Field>

      <Button type="submit" size="lg" loading={submitting} className="mt-2">
        {submitting ? messages.auth.signingUp : messages.auth.signupSubmit}
      </Button>
    </form>
  )
}
