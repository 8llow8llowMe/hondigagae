'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  codeSchema,
  type CodeValues,
  emailSchema,
  type EmailValues,
  signupProfileSchema,
  type SignupProfileValues,
} from '@/features/auth/schemas'
import { CodeStep, EmailStep, ProfileStep } from '@/features/auth/signup-steps'
import { sendEmailCode, signup, verifyEmailCode } from '@/lib/api/auth'
import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { remainingSeconds } from '@/lib/form/cooldown'
import { apiErrorToFormErrors, type FormErrors } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'

/** 백엔드 send-code 쿨다운 (AuthWebController 문서 실측) */
const RESEND_COOLDOWN_SECONDS = 60

type Step = 'email' | 'code' | 'profile'

/**
 * 회원가입 3단계 상태·요청을 소유한다. 단계 컴포넌트는 props 만 받는
 * presentational — `signup-steps.tsx` 참고.
 *
 * **인증 상태는 프론트가 아니라 서버가 들고 있다.** `verify-code` 는 토큰을 주지
 * 않고 서버에 "이 이메일은 인증됨(30분)" 을 남긴다. 새로고침하면 1단계로
 * 돌아가는 것은 의도된 동작이다 — 회원가입-세부명세.md D3/D8-1.
 */
export function SignupForm({ returnTo }: { returnTo: string }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  // 쿨다운은 "남은 초"를 직접 감산하는 state 가 아니라 시작 시각을 들고, 렌더마다
  // remainingSeconds(순수 함수) 로 다시 계산한다 — form-guide.md §2, 회원가입-세부명세.md D7.
  const [cooldownStartedAt, setCooldownStartedAt] = useState<number | null>(null)
  // remainingSeconds 는 Date.now() 를 다시 읽어야 값이 바뀐다. 이 값 자체는 쓰지 않고
  // setInterval 이 1초마다 재렌더를 트리거하는 용도로만 갱신한다
  const [, forceCooldownTick] = useState(0)
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null)
  const [isResending, setResending] = useState(false)
  const resendingRef = useRef(false)

  // AUTH_005(코드 만료)/MEMBER_006(인증 미완료)로 1단계에 되돌아왔을 때 보여줄 안내.
  // 두 오류 모두 도착 시점엔 codeForm/profileForm 오류로 세팅되지만 그 단계는 더 이상
  // 화면에 없다 — 되돌아간 1단계에 별도로 실어야 사용자가 이유를 알 수 있다 (D4).
  const [stepBackMessage, setStepBackMessage] = useState<string | null>(null)

  // 필드로 좁혀지지 않는 5xx·무응답을 단계별로 구분한다 — LoginFormFields 와 같은 패턴
  const [emailErrorStatus, setEmailErrorStatus] = useState<number | null>(null)
  const [codeErrorStatus, setCodeErrorStatus] = useState<number | null>(null)
  const [profileErrorStatus, setProfileErrorStatus] = useState<number | null>(null)

  // CodeStep 의 ErrorState 재시도가 코드 검증 재제출인지 재전송 재시도인지 구분한다
  const [codeAction, setCodeAction] = useState<'verify' | 'resend'>('verify')

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

  // 단계 전환 시 새 단계의 첫 입력으로 포커스를 옮긴다 — 회원가입-세부명세.md D6
  useEffect(() => {
    const focusId = step === 'email' ? 'email' : step === 'code' ? 'code' : 'password'
    containerRef.current?.querySelector<HTMLElement>(`#${focusId}`)?.focus()
  }, [step])

  const emailForm = useForm<EmailValues, void>({
    schema: emailSchema,
    initialValues: { email: '' },
    onSubmit: async (values) => {
      // 이전 되돌림 안내가 새 제출 결과를 가리지 않게 먼저 지운다
      setStepBackMessage(null)
      try {
        await sendEmailCode(values.email)
        setEmailErrorStatus(null)
      } catch (error) {
        setEmailErrorStatus(error instanceof ApiError ? error.status : NO_RESPONSE_STATUS)
        throw error
      }
    },
    onSuccess: (_result, values) => {
      setEmail(values.email)
      setCooldownStartedAt(Date.now())
      setCodeErrorStatus(null)
      setStep('code')
    },
  })

  const codeForm = useForm<CodeValues, void>({
    schema: codeSchema,
    initialValues: { code: '' },
    onSubmit: async (values) => {
      setCodeAction('verify')
      try {
        await verifyEmailCode(email, values.code)
        setCodeErrorStatus(null)
      } catch (error) {
        if (!(error instanceof ApiError)) {
          setCodeErrorStatus(NO_RESPONSE_STATUS)
          throw error
        }

        setCodeErrorStatus(error.status)

        // AUTH_004(코드 불일치): 도메인 예외라 서버가 필드를 특정하지 않는다.
        // 코드 필드 오류로 보여야 하므로(D4) toFormErrors 가 필드 오류로 읽을 모양으로
        // 다시 감싼다. field-errors.ts 는 건드리지 않는다 — 소비만 한다.
        if (error.resultCode === 'AUTH_004') {
          throw new ApiError(error.status, error.resultCode, {
            errors: [{ field: 'code', message: error.message }],
          })
        }

        // AUTH_005(코드 만료): 1단계로 되돌린다 — 정본 D4. 빈 useEffect 로 감시하지
        // 않고 실패한 자리(.catch)에서 바로 처리한다.
        if (error.resultCode === 'AUTH_005') {
          setStep('email')
          setStepBackMessage(apiErrorToFormErrors(error, messages.form.submitFailed).form)
        }

        throw error
      }
    },
    onSuccess: () => {
      setDuplicateEmail(null)
      setProfileErrorStatus(null)
      setStep('profile')
    },
  })

  // AUTH_004 매핑 결과(코드 필드 오류)가 나면 코드만 비우고 포커스한다.
  // submitCount 만 의존한다 — errors 를 넣으면 입력 중 setValue 가 필드 오류를 지울
  // 때마다 effect 가 다시 돌아 타이핑 중인 필드에서 포커스를 훔친다
  // (use-form.ts 의 submitCount 주석, login-form.tsx 의 같은 패턴 참고)
  useEffect(() => {
    if (codeForm.submitCount === 0) return
    if (codeForm.firstErrorField === 'code') {
      codeForm.setValue('code', '')
      containerRef.current?.querySelector<HTMLElement>('#code')?.focus()
    }
  }, [codeForm.submitCount])

  const profileForm = useForm<SignupProfileValues, void>({
    schema: signupProfileSchema,
    initialValues: { password: '', name: '', nickname: '' },
    onSubmit: async (values) => {
      try {
        await signup({ email, ...values })
        setDuplicateEmail(null)
      } catch (error) {
        if (!(error instanceof ApiError)) {
          setProfileErrorStatus(NO_RESPONSE_STATUS)
          setDuplicateEmail(null)
          throw error
        }

        setProfileErrorStatus(error.status)

        // 409: 이 요청에서만 이메일 중복이 드러난다 — send-code 가 계정 열거 방지로
        // 가입 여부와 무관하게 항상 성공하기 때문이다(정본 D4). 여기서만 판정한다.
        // submit() 완료 후 stale 한 profileForm.errors 를 읽는 방식은 쓰지 않는다.
        if (error.kind === 'conflict') {
          setDuplicateEmail(email)
          // 3단계까지 입력한 비밀번호·이름·닉네임은 버린다 — 다른 계정 정보라 유지할
          // 이유가 없다(정본 D4). submit() 의 catch 가 이 직후 서버 문구로 errors 를
          // 다시 채우므로(아래 throw), 배너는 남고 값만 비워진다.
          profileForm.reset()
        } else {
          // 성공 경로와 다른 오류에서는 되돌린다 — 5xx 도 중복으로 오판하지 않는다
          setDuplicateEmail(null)

          // MEMBER_006(인증 미완료): 1단계로 되돌린다 — 정본 D4
          if (error.resultCode === 'MEMBER_006') {
            setStep('email')
            setStepBackMessage(apiErrorToFormErrors(error, messages.form.submitFailed).form)
          }
        }

        throw error
      }
    },
    onSuccess: () => {
      // dataBody 가 null 이라 자동 로그인이 안 된다. 로그인 화면으로 보내고
      // 이메일을 미리 채운다 — 정본 D0. signedUp=1 은 가입 완료 배너 전용 표식이다.
      // 409 "로그인하기" 링크와 같은 /login?returnTo=…&email=… 셰이프를 쓰므로
      // email 유무로는 구분할 수 없다 — 중복 계정 케이스에도 배너가 잘못 뜬다.
      const params = new URLSearchParams({ returnTo, email, signedUp: '1' })
      router.replace(`/login?${params.toString()}`)
    },
  })

  const handleResend = useCallback(() => {
    // 쿨다운 가드에 더해 재진입 가드(ref)를 겹친다 — disabled 반영 전 빠른 연속
    // 클릭으로 sendEmailCode 가 중복 호출되는 것을 막는다 (form-guide.md §6)
    if (cooldownSeconds > 0 || resendingRef.current) return
    resendingRef.current = true
    setResending(true)
    setCodeAction('resend')
    void sendEmailCode(email)
      .then(() => {
        setCooldownStartedAt(Date.now())
        setCodeErrorStatus(null)
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === 'rate-limited') {
          // 쿨다운을 유지해 재전송 버튼을 계속 비활성 상태로 둔다(D4). ErrorState 가
          // 아니라 FormAlert 로만 보여준다 — codeForm 오류에 실어 CodeStep 이 그대로 렌더한다
          setCooldownStartedAt(Date.now())
          codeForm.setErrors(apiErrorToFormErrors(error, messages.form.submitFailed))
          return
        }
        setCodeErrorStatus(error instanceof ApiError ? error.status : NO_RESPONSE_STATUS)
      })
      .finally(() => {
        resendingRef.current = false
        setResending(false)
      })
  }, [cooldownSeconds, email, codeForm.setErrors])

  const emailStepErrors: FormErrors =
    stepBackMessage !== null
      ? { fields: emailForm.errors.fields, form: stepBackMessage }
      : emailForm.errors

  if (step === 'email') {
    return (
      <div ref={containerRef} className="flex flex-col gap-6">
        <h1 className="text-title-1 text-fg font-bold">{messages.auth.signupTitle}</h1>
        <EmailStep
          values={emailForm.values}
          errors={emailStepErrors}
          errorStatus={emailErrorStatus}
          isSubmitting={emailForm.isSubmitting}
          onValueChange={(key, value) => {
            setStepBackMessage(null)
            emailForm.setValue(key, value)
          }}
          onSubmit={() => void emailForm.submit()}
          onRetry={() => void emailForm.submit()}
        />
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div ref={containerRef} className="flex flex-col gap-6">
        <h1 className="text-title-1 text-fg font-bold">{messages.auth.signupTitle}</h1>
        <CodeStep
          email={email}
          values={codeForm.values}
          errors={codeForm.errors}
          errorStatus={codeErrorStatus}
          isSubmitting={codeForm.isSubmitting}
          cooldownSeconds={cooldownSeconds}
          resending={isResending}
          notice={messages.auth.codeSent}
          onValueChange={(key, value) => codeForm.setValue(key, value)}
          onSubmit={() => void codeForm.submit()}
          onResend={handleResend}
          onChangeEmail={() => {
            codeForm.reset()
            setCooldownStartedAt(null)
            setCodeErrorStatus(null)
            setStep('email')
          }}
          onRetry={() => (codeAction === 'resend' ? handleResend() : void codeForm.submit())}
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <h1 className="text-title-1 text-fg font-bold">{messages.auth.signupTitle}</h1>
      <ProfileStep
        values={profileForm.values}
        errors={profileForm.errors}
        errorStatus={profileErrorStatus}
        isSubmitting={profileForm.isSubmitting}
        duplicateEmail={duplicateEmail}
        returnTo={returnTo}
        notice={messages.auth.codeVerified}
        onValueChange={(key, value) => {
          // duplicateEmail 은 여기서 지우지 않는다 — 409 이후에도 "로그인하기" 링크가
          // 계속 보여야 한다(정본 D4). 지우는 지점은 profileForm 의 다음 제출 결과
          // (성공 / 409 아닌 다른 오류)뿐이다 — 그 외에는 값을 고쳐도 이 화면에서
          // 할 수 있는 일이 없다(이메일은 1단계 값이라 여기서 못 바꾼다).
          profileForm.setValue(key, value)
        }}
        onSubmit={() => void profileForm.submit()}
        onRetry={() => void profileForm.submit()}
      />
    </div>
  )
}
