'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  PasswordResetCodeStep,
  PasswordResetDone,
  PasswordResetEmailStep,
} from '@/features/auth/password-reset-steps'
import {
  emailSchema,
  type EmailValues,
  passwordResetSchema,
  type PasswordResetValues,
} from '@/features/auth/schemas'
import { resetPassword, sendPasswordResetCode } from '@/lib/api/auth'
import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { remainingSeconds } from '@/lib/form/cooldown'
import { apiErrorToFormErrors, type FormErrors } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'

/** 백엔드 `PasswordResetProcessor.RESEND_COOLDOWN` (소스 실측) */
const RESEND_COOLDOWN_SECONDS = 60

type Step = 'email' | 'code' | 'done'

/**
 * 비밀번호 찾기 2단계 + 완료. 상태·요청을 여기서 소유하고 단계 컴포넌트는 props 만 받는다
 * (`password-reset-steps.tsx`).
 *
 * **한 라우트에서 두 단계를 진행한다.** 쪼개면 2단계에서 이메일을 다시 받거나 URL 에
 * 실어야 하는데, 이메일을 주소창·기록·공유 링크에 남길 이유가 없다 — 정본 D0/D3.
 * 새로고침하면 1단계로 돌아가는 편이 낫다.
 *
 * React Query 를 쓰지 않는다 — 조회가 없고 캐시할 것도 없다.
 */
export function PasswordResetView() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // 쿨다운은 "남은 초" state 를 감산하지 않고 시작 시각을 들고 매 렌더 다시 계산한다 —
  // 백그라운드 탭에서 setInterval 이 스로틀링돼도 남은 초가 어긋나지 않는다 (form-guide.md §2)
  const [cooldownStartedAt, setCooldownStartedAt] = useState<number | null>(null)
  const [, forceCooldownTick] = useState(0)
  const [isResending, setResending] = useState(false)
  const resendingRef = useRef(false)

  // AUTH_005/AUTH_017 로 1단계에 되돌아왔을 때 이유를 싣는다. 도착 시점엔 resetForm 오류지만
  // 그 단계는 더 이상 화면에 없다 — 되돌아간 1단계에 따로 실어야 사용자가 이유를 안다 (D4)
  const [stepBackMessage, setStepBackMessage] = useState<string | null>(null)

  const [emailErrorStatus, setEmailErrorStatus] = useState<number | null>(null)
  const [resetErrorStatus, setResetErrorStatus] = useState<number | null>(null)

  // 2단계 ErrorState 의 재시도가 재설정 재제출인지 재발송 재시도인지 구분한다
  const [codeAction, setCodeAction] = useState<'reset' | 'resend'>('reset')

  useEffect(() => {
    if (cooldownStartedAt === null) return
    const interval = setInterval(() => {
      const remaining = remainingSeconds(cooldownStartedAt, RESEND_COOLDOWN_SECONDS, Date.now())
      if (remaining <= 0) {
        setCooldownStartedAt(null)
        return
      }
      forceCooldownTick((tick) => tick + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldownStartedAt])

  const cooldownSeconds =
    cooldownStartedAt === null
      ? 0
      : remainingSeconds(cooldownStartedAt, RESEND_COOLDOWN_SECONDS, Date.now())

  // 단계 **전환** 시에만 새 단계의 첫 입력으로 포커스를 옮긴다. 진입 시에도 돌면 화면에
  // 들어오자마자 포커스가 입력으로 가서 스크린리더가 제목을 건너뛴다. 판정을 "최초 실행
  // 여부" 가 아니라 "직전 step 과 달라졌는지" 로 하는 이유는 StrictMode 가 마운트 시
  // effect 를 두 번 돌리기 때문이다 — signup-form.tsx 가 실측으로 겪은 회귀와 같다.
  const previousStepRef = useRef<Step>(step)
  useEffect(() => {
    if (previousStepRef.current === step) return
    previousStepRef.current = step
    if (step === 'done') return
    const focusId = step === 'email' ? 'email' : 'code'
    containerRef.current?.querySelector<HTMLElement>(`#${focusId}`)?.focus()
  }, [step])

  const emailForm = useForm<EmailValues, void>({
    schema: emailSchema,
    initialValues: { email: '' },
    onSubmit: async (values) => {
      setStepBackMessage(null)
      try {
        await sendPasswordResetCode(values.email)
        setEmailErrorStatus(null)
      } catch (error) {
        setEmailErrorStatus(error instanceof ApiError ? error.status : NO_RESPONSE_STATUS)
        throw error
      }
    },
    onSuccess: (_result, values) => {
      // **성공 응답은 계정이 있든 없든 같다.** 여기서 분기를 만들면 계정 열거가 된다 (D1)
      setEmail(values.email)
      setCooldownStartedAt(Date.now())
      setResetErrorStatus(null)
      /*
        **2단계 폼을 비운다.** `AUTH_005`·`AUTH_017` 로 되돌아온 뒤 새 코드를 받고 오는 경로가
        여기다. 비우지 않으면 방금 성공한 발송에 (a) 무효화된 옛 코드가 입력에 남고
        (b) "시도 횟수를 초과했습니다" 가 `role="alert"` 로 다시 떠서 (c) 아래 `notice` 조건이
        그것을 오류로 보고 "메일을 보냈어요" 를 지운다 — 정본 D5 의 "발송 성공 → 2단계 + 안내"
        와 정면으로 어긋난다. 브라우저 실측으로 재현한 회귀다 (`onChangeEmail` 과 같은 처리).
      */
      resetForm.reset()
      setStep('code')
    },
  })

  const resetForm = useForm<PasswordResetValues, void>({
    schema: passwordResetSchema,
    initialValues: { code: '', newPassword: '' },
    onSubmit: async (values) => {
      setCodeAction('reset')
      try {
        await resetPassword({ email, code: values.code, newPassword: values.newPassword })
        setResetErrorStatus(null)
      } catch (error) {
        if (!(error instanceof ApiError)) {
          setResetErrorStatus(NO_RESPONSE_STATUS)
          throw error
        }

        setResetErrorStatus(error.status)

        // AUTH_004(불일치): 도메인 예외라 서버가 필드를 특정하지 않는다. 코드 필드 오류로
        // 보여야 하므로(D4) `fieldErrors` 자리에 직접 실어 준다
        if (error.resultCode === 'AUTH_004') {
          throw new ApiError(error.status, error.resultCode, error.rawMessage, [
            { code: error.resultCode, field: 'code', message: error.message },
          ])
        }

        /*
          AUTH_005(만료·미발급)와 AUTH_017(5회 초과)은 **같은 처리**다 — 코드가 더는
          유효하지 않으니 다시 받아야 한다. 1단계로 되돌리고 서버 문구를 그대로 싣는다.

          우리 문장을 덧붙이지 않는다: 두 문구가 이미 "다시 요청해주세요" 로 끝난다
          (`AuthErrorCode` 실측). 덧붙이면 같은 말이 두 번 나온다.
        */
        if (error.resultCode === 'AUTH_005' || error.resultCode === 'AUTH_017') {
          setStep('email')
          setStepBackMessage(apiErrorToFormErrors(error, messages.form.submitFailed).form)
        }

        throw error
      }
    },
    onSuccess: () => {
      setStep('done')
    },
  })

  // AUTH_004 로 코드 필드 오류가 잡히면 코드만 비우고 포커스한다. 새 비밀번호는 남긴다 —
  // 틀린 것은 코드지 비밀번호가 아니다. submitCount 만 의존하는 이유는 use-form.ts 참고
  useEffect(() => {
    if (resetForm.submitCount === 0) return
    if (resetForm.firstErrorField === 'code') {
      // keepError: 방금 띄운 코드 오류를 이 호출이 지우면 무음 실패가 된다
      resetForm.setValue('code', '', { keepError: true })
      containerRef.current?.querySelector<HTMLElement>('#code')?.focus()
    }
  }, [resetForm.submitCount])

  const handleResend = useCallback(() => {
    // 쿨다운 가드에 재진입 가드(ref)를 겹친다 — disabled 반영 전 연속 클릭을 막는다
    if (cooldownSeconds > 0 || resendingRef.current) return
    resendingRef.current = true
    setResending(true)
    setCodeAction('resend')
    void sendPasswordResetCode(email)
      .then(() => {
        setCooldownStartedAt(Date.now())
        setResetErrorStatus(null)
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === 'rate-limited') {
          // AUTH_003(이메일 60초) · AUTH_016(IP 상한) 둘 다 429 다. 쿨다운을 유지해 버튼을
          // 계속 비활성으로 두고, 원인은 서버 문구가 갈라 준다 — 우리가 짓지 않는다
          setCooldownStartedAt(Date.now())
          resetForm.setErrors(apiErrorToFormErrors(error, messages.form.submitFailed))
          return
        }
        setResetErrorStatus(error instanceof ApiError ? error.status : NO_RESPONSE_STATUS)
      })
      .finally(() => {
        resendingRef.current = false
        setResending(false)
      })
  }, [cooldownSeconds, email, resetForm.setErrors])

  const emailStepErrors: FormErrors =
    stepBackMessage !== null
      ? { fields: emailForm.errors.fields, form: stepBackMessage }
      : emailForm.errors

  const heading =
    step === 'email'
      ? messages.auth.resetEmailHeading
      : step === 'code'
        ? messages.auth.resetCodeHeading
        : messages.auth.resetDoneTitle

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <h1 className="text-title-1 text-fg font-bold">{messages.auth.resetTitle}</h1>
      {/*
        단계는 시각적으로만 바뀐다 — 스크린리더에는 아무 일도 일어나지 않은 것과 같다.
        현재 단계 제목을 live 영역으로도 내보낸다 (정본 D6).
      */}
      <p aria-live="polite" className="text-body-1 text-fg font-semibold">
        {heading}
      </p>

      {step === 'email' && (
        <PasswordResetEmailStep
          values={emailForm.values}
          errors={emailStepErrors}
          errorStatus={emailErrorStatus}
          submitting={emailForm.isSubmitting}
          onValueChange={(key, value) => {
            setStepBackMessage(null)
            // 5xx/무응답 ErrorState 에서 값을 고치면 폼으로 복귀한다 — 로그인·회원가입과 동일
            setEmailErrorStatus(null)
            emailForm.setValue(key, value)
          }}
          onSubmit={() => void emailForm.submit()}
          onRetry={() => void emailForm.submit()}
        />
      )}

      {step === 'code' && (
        <PasswordResetCodeStep
          email={email}
          values={resetForm.values}
          errors={resetForm.errors}
          errorStatus={resetErrorStatus}
          submitting={resetForm.isSubmitting}
          cooldownSeconds={cooldownSeconds}
          resending={isResending}
          showPassword={showPassword}
          // 오류가 떠 있으면 성공 안내를 끈다 — role=status 와 role=alert 가 동시에 뜬다
          notice={resetForm.errors.form === null ? messages.auth.resetCodeSent : undefined}
          onValueChange={(key, value) => {
            setResetErrorStatus(null)
            resetForm.setValue(key, value)
          }}
          onTogglePassword={() => setShowPassword((previous) => !previous)}
          onSubmit={() => void resetForm.submit()}
          onResend={handleResend}
          onChangeEmail={() => {
            resetForm.reset()
            setCooldownStartedAt(null)
            setResetErrorStatus(null)
            setStep('email')
          }}
          onRetry={() => (codeAction === 'resend' ? handleResend() : void resetForm.submit())}
        />
      )}

      {step === 'done' && <PasswordResetDone email={email} />}
    </div>
  )
}
