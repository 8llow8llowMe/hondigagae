'use client'

import { Button, ButtonLink } from '@/components/button'
import { Field } from '@/components/field'
import { FormFailure } from '@/components/form-failure'
import { FormNotice } from '@/components/form-notice'
import { Input } from '@/components/input'
import { PasswordInput } from '@/components/password-input'
import type { EmailValues, PasswordResetValues } from '@/features/auth/schemas'
import { VerificationCodeInput } from '@/features/auth/verification-code-input'
import type { FormErrors } from '@/lib/form/field-errors'
import { type FailureAnnounce, submitFailureAnnounce } from '@/lib/form/submit-failure-focus'
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
  /**
   * 폼 전체 실패가 무엇으로 읽히는가 (#1102). 생략하면 포커스 순서의 첫 대상으로 정한다
   * (`submitFailureAnnounce`). 되돌림 안내처럼 포커스를 이메일 칸으로 보내는 갈래는
   * `PasswordResetView` 가 `live` 를 넘긴다.
   */
  announce?: FailureAnnounce | undefined
  onValueChange: (key: keyof EmailValues, value: string) => void
  onSubmit: () => void
  onRetry: () => void
}

export function PasswordResetEmailStep({
  values,
  errors,
  errorStatus,
  submitting,
  announce = submitFailureAnnounce(errors, errorStatus),
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
        — `signup-form.tsx` 의 stepBackMessage 와 같은 처리. 포커스는 단계 전환 effect 가 이메일
        칸으로 옮기므로 그 갈래는 `announce="live"` 로 온다 (#1102).
      */}
      <FormFailure
        message={errors.form}
        errorStatus={errorStatus}
        submitting={submitting}
        announce={announce}
        onRetry={onRetry}
      />

      {/* 칸 하나뿐인 폼의 `*` 는 정보가 없다 — 로그인과 같은 규칙 (#1283 C5) */}
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
        // 제출 · 재발송 실패 뒤 포커스와 같은 판정이다 (#1102, `resendFocusTargets`)
        announce={submitFailureAnnounce(errors, errorStatus)}
        onRetry={onRetry}
      />
      {/* 이메일은 줄바꿈 기회가 없는 토큰이다 — 375px 폭에서 넘치지 않게 break-all */}
      <p className="text-body-2 text-fg-muted break-all">{email}</p>

      {/* 이 단계의 두 칸은 둘 다 필수라 `*` 를 달지 않는다 (#1283 C5) */}
      <Field id="code" label={messages.auth.codeLabel} error={errors.fields.code}>
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
 * 이메일은 재설정 성공 때 넘겨 두므로(`login-email-handoff.ts`, #1158) 이어지는 로그인은 비밀번호 한 번이다.
 *
 * **제목(`resetDoneTitle`)은 여기서 렌더하지 않는다.** `PasswordResetView` 의 단계 제목이
 * 이미 그 문구를 aria-live 영역으로 내보낸다 — 여기서 또 쓰면 같은 문장이 두 번 읽힌다.
 */
export function PasswordResetDone() {
  return (
    // `data-reset-done` — 완료 전환 때 포커스가 찾아오는 자리다 (`PasswordResetView`, #1283)
    <div data-reset-done="" className="flex flex-col items-start">
      {/* 이메일은 URL 이 아니라 넘겨주기로 간다 — 재설정 성공 시점에 넘겼다 (#1158) */}
      <ButtonLink href="/login" size="lg">
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
      {/* 단계 질문이 본문의 큰 글자다 — 화면 이름은 상단바가 작게 든다 (#1283 C4) */}
      {/* 보이는 가장 큰 제목이라 구조도 제목이다 — 화면 이름(상단바 `h1`) 아래 `h2` */}
      <h2 className="text-title-1 text-fg font-bold">{heading}</h2>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
    </div>
  )
}
