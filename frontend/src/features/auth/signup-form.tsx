'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { AuthTopBar } from '@/features/auth/auth-top-bar'
import { enterAfterSignup } from '@/features/auth/enter-after-signup'
import { enterSession } from '@/features/auth/enter-session'
import {
  codeSchema,
  type CodeValues,
  emailSchema,
  type EmailValues,
  signupConsentSchema,
  signupProfileSchema,
  type SignupProfileValues,
} from '@/features/auth/schemas'
import { SignupConsentSheet } from '@/features/auth/signup-consent-sheet'
import { SignupConsentAction, SignupStepHeading } from '@/features/auth/signup-parts'
import { CodeStep, EmailStep, ProfileStep } from '@/features/auth/signup-steps'
import { login, sendEmailCode, signup, verifyEmailCode } from '@/lib/api/auth'
import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { handOffLoginEmail } from '@/lib/auth/login-email-handoff'
import {
  clearConsentErrors,
  hasConsentErrors,
  isSignupConsentComplete,
  SIGNUP_CONSENT_KEYS,
  type SignupConsent,
  type SignupConsentKey,
  toConsentErrors,
} from '@/lib/auth/signup-consent'
import { codeStepAfterResend, type ResendOutcome } from '@/lib/form/code-step-after-resend'
import { remainingSeconds } from '@/lib/form/cooldown'
import { apiErrorToFormErrors, type FormErrors, NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { formErrorsAfterEdit } from '@/lib/form/form-failure-display'
import { returnFocusTarget } from '@/lib/form/return-focus'
import {
  focusResendResult,
  focusSubmitFailure,
  type ResendResult,
} from '@/lib/form/submit-failure-focus'
import { useForm } from '@/lib/form/use-form'
import { useUnsavedWarning } from '@/lib/form/use-unsaved-warning'
import { validate } from '@/lib/form/validate'
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
 *
 * **동의 값은 이 컴포넌트가 소유하지 않는다.** 같은 화면의 소셜 버튼도 같은 동의를
 * 써야 해서 `SignupScreen` 이 들고 있고, 여기는 값을 받아 그리고 검증한다 (#688).
 * 검증 결과(`consentErrors`)만 여기 남는 이유는 그것이 **이 폼의 제출 결과**이기
 * 때문이다 — 서버 오류도 같은 제출에서 돌아온다.
 */
export type SignupFormProps = {
  returnTo: string
  consent: SignupConsent
  onConsentChange: (key: SignupConsentKey, checked: boolean) => void
  /** 전체 동의 (#1083). 셋을 한꺼번에 바꾸는 것은 소유자(`SignupScreen`)의 몫이다 */
  onConsentAllChange: (checked: boolean) => void
  /** 이메일 단계의 `←` — 가입 방법 고르기로 돌아간다 (#1284) */
  onExit: () => void
}

export function SignupForm({
  returnTo,
  consent,
  onConsentChange,
  onConsentAllChange,
  onExit,
}: SignupFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  /*
    **자동 로그인이 성공해 이동을 시작하면 버튼을 도는 채로 둔다** (#1158). `enterSession` 의
    `location.replace` 는 이동을 시작만 하고 돌아와, `useForm` 이 곧 제출 중 표시를 내린다 — 새
    문서가 오기 전 틈에 `가입하기` 가 다시 눌리면 409 를 맞는다. `login-form.tsx` 의 같은 이름
    상태와 같은 이유다. 성공은 되돌릴 일이 없어 한 번 켜면 끄지 않는다.
  */
  const [entering, setEntering] = useState(false)
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
  /*
    재전송이 **끝났다**는 사건 — 포커스 effect 의 트리거다 (#1102). `submitCount` 와 같은 이유로
    결과 값이 아니라 횟수를 센다: 같은 결과가 연달아 나도 effect 가 다시 돈다.
  */
  const [resendOutcome, setResendOutcome] = useState<{ count: number; result: ResendResult }>({
    count: 0,
    result: 'sent',
  })

  // AUTH_005(코드 만료)/MEMBER_006(인증 미완료)로 1단계에 되돌아왔을 때 보여줄 안내.
  // 두 오류 모두 도착 시점엔 codeForm/profileForm 오류로 세팅되지만 그 단계는 더 이상
  // 화면에 없다 — 되돌아간 1단계에 별도로 실어야 사용자가 이유를 알 수 있다 (D4).
  const [stepBackMessage, setStepBackMessage] = useState<string | null>(null)

  // 동의 블록의 오류. 클라이언트 검증(MEMBER_115/116/117 복제본)과 서버 응답
  // (MEMBER_115/116/117 · MEMBER_010/011)이 같은 자리에 모인다 — #688
  const [consentErrors, setConsentErrors] = useState<FormErrors>(NO_FORM_ERRORS)
  /*
    약관 시트가 무엇을 하려고 떴는가 (#1284, 회원가입-세부명세 D14). `sendCode` 는 1단계 첫 발송 전,
    `signup` 은 3단계에서 서버가 동의를 거부했을 때(`MEMBER_115/116/117` · `MEMBER_010/011`)다.
    null 이면 닫혀 있다.
  */
  const [consentSheet, setConsentSheet] = useState<'sendCode' | 'signup' | null>(null)
  /*
    약관 시트를 **닫을 때** 포커스가 돌아갈 자리 (#1295 N2, 회원가입-세부명세 D15). `BottomSheet` 의
    `triggerRef` 로 넘기고 `current` 는 닫히는 순간에 채운다(`handleConsentSheetClose`). `null` 이면
    `useOverlay` 가 예전대로 열기 직전의 활성 요소로 돌아간다.
  */
  const consentReturnFocusRef = useRef<HTMLElement | null>(null)

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

  // 단계 전환 시 새 단계의 첫 입력으로 포커스를 옮긴다 — 회원가입-세부명세.md D6.
  // "전환 시" 이지 "진입 시" 가 아니다: 첫 렌더에도 이 effect 가 돌면 /signup 진입
  // 즉시 이메일 입력으로 포커스가 가서 스크린리더가 제목·단계 표시를 건너뛴다
  // — 이슈 #24 최종 리뷰 M8.
  //
  // "최초 실행 여부"가 아니라 **직전에 본 step 과 실제로 달라졌는지**로 판정한다.
  // React StrictMode(dev 기본값)는 마운트 시 이 effect 를 두 번 호출하는데, "최초
  // 실행만 건너뛴다"는 플래그 방식은 그 두 번째 호출을 "전환"으로 오인해 진입
  // 즉시 포커스를 훔친다 — 실측(localhost:5174)으로 확인한 회귀. previousStepRef 를
  // step 값 자체로 초기화하면 (a) 진짜 첫 마운트와 StrictMode 의 재호출 모두
  // "안 바뀜"으로 판정되고 (b) 실제 단계 전환만 "바뀜"으로 판정된다.
  const previousStepRef = useRef<Step>(step)
  /*
    **마운트 때 이메일 칸으로 간다** (#1284). 이 폼은 진입 화면에서 `이메일로 가입하기` 를 눌러야만
    서므로 마운트가 곧 사용자 동작의 결과다 — 누른 버튼이 사라져 포커스가 `BODY` 로 떨어진다.
    StrictMode 가 두 번 불러도 같은 칸에 두 번 둘 뿐이다.
  */
  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>('#email')?.focus()
  }, [])
  useEffect(() => {
    if (previousStepRef.current === step) return
    previousStepRef.current = step
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
        // 코드 필드 오류로 보여야 하므로(D4) `fieldErrors` 자리에 직접 실어 준다.
        // field-errors.ts 는 건드리지 않는다 — 소비만 한다.
        if (error.resultCode === 'AUTH_004') {
          throw new ApiError(error.status, error.resultCode, error.rawMessage, [
            { code: error.resultCode, field: 'code', message: error.message },
          ])
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
    // AUTH_005 로 1단계에 되돌아갔으면 단계 전환 effect 가 이메일로 옮긴다 — 겹치지 않는다
    if (step !== 'code') return
    if (codeForm.errors.fields.code !== undefined) {
      // keepError: true — 방금 표시한 코드 필드 오류를 이 호출이 지우면 안 된다.
      // setValue 의 기본 동작은 "사용자가 고쳤다"로 보고 그 필드 오류를 지우는데,
      // 여기는 프로그램이 재입력을 유도하려고 비우는 것이라 오류는 남아야 사용자가
      // 왜 실패했는지 알 수 있다 — 실측에서 이 오류 문구가 통째로 사라지는 무음
      // 실패를 확인했다(use-form.ts 의 setValue JSDoc 참고).
      codeForm.setValue('code', '', { keepError: true })
      containerRef.current?.querySelector<HTMLElement>('#code')?.focus()
      return
    }
    // 코드 오류가 아닌 실패(429 · 5xx · 무응답)는 알림으로 — `BODY` 에 남기지 않는다 (#1078)
    focusSubmitFailure(containerRef.current, codeForm.errors, codeErrorStatus)
  }, [codeForm.submitCount])

  const profileForm = useForm<SignupProfileValues, void>({
    schema: signupProfileSchema,
    initialValues: { password: '', name: '', nickname: '' },
    onSubmit: async (values) => {
      try {
        // 동의 3종은 필수 필드다 — 빠뜨리면 MEMBER_115/116/117 로 400 이다 (#688)
        await signup({ email, ...values, ...consent })
        setDuplicateEmail(null)
        setConsentErrors(NO_FORM_ERRORS)
      } catch (error) {
        if (!(error instanceof ApiError)) {
          setProfileErrorStatus(NO_RESPONSE_STATUS)
          setDuplicateEmail(null)
          setConsentErrors(NO_FORM_ERRORS)
          throw error
        }

        setProfileErrorStatus(error.status)

        /*
          동의 관련 실패를 동의 블록으로 옮긴다. `MEMBER_115/116/117` 은 `field` 가 함께
          와서 기존 매핑을 그대로 타고, `MEMBER_010/011` 은 `field` 가 없어 **코드로**
          어느 체크박스인지 판정한다 (`toConsentErrors` 의 JSDoc).
        */
        const nextConsentErrors = toConsentErrors(
          apiErrorToFormErrors(error, messages.form.submitFailed),
          error.resultCode,
          consent,
        )
        setConsentErrors(nextConsentErrors)
        /*
          동의 블록이 이제 화면에 없다 (#1284) — 거부된 항목을 보일 자리는 약관 시트다. 같은 시트를
          다시 띄워 그 항목에 오류를 달고, 실행 버튼은 "동의하고 가입하기" 로 이 제출을 다시 낸다.
        */
        if (hasConsentErrors(nextConsentErrors)) setConsentSheet('signup')

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

      /*
        **가입 직후 같은 자격으로 로그인을 이어 부른다** (#1158, 사용자 결정 2026-10-06 — 정본 D8 #3
        개정). 가입 응답은 토큰을 주지 않는다(`dataBody: null`). 로그인이 실패하면 예전처럼 로그인
        화면(`signedUp=1` 가입 완료 안내)으로 가고, 이메일은 URL 이 아니라 넘겨주기로 간다 —
        판정과 근거는 `enter-after-signup.ts`. **던지지 않는다** — 가입은 이미 됐다.

        **`onSuccess` 가 아니라 여기서 기다린다.** `onSuccess` 는 제출 중 표시가 풀리기 직전에
        동기로 불려, 로그인이 도는 동안 `가입하기` 가 다시 눌려 409 를 맞을 수 있다. 여기서
        기다리면 `가입 중` 이 로그인 응답까지 남고, 그 뒤 이동 중의 틈은 `entering` 이 막는다.

        세션 진입은 **문서째 새로 받는다**(`enterSession`) — 로그인 화면과 같은 이유다(#1075).
      */
      await enterAfterSignup(
        {
          login,
          enter: (href) => {
            setEntering(true)
            enterSession({ queryClient, location: globalThis.location }, href)
          },
          toLogin: (href) => router.replace(href),
          handOff: handOffLoginEmail,
        },
        { email, password: values.password, returnTo },
      )
    },
  })

  // 3단계(비밀번호·이름·닉네임 입력) 이탈 경고.
  // 조건과 근거는 useUnsavedWarning 의 JSDoc 에 있다 (form-guide.md §7).
  useUnsavedWarning(step === 'profile' && profileForm.isDirty && !profileForm.isSubmitting)

  /*
    재전송 결과를 코드 칸에 반영한다 (#1109) — 판정은 `codeStepAfterResend` 하나다(재설정 2단계와 같다).
    값을 비울 때 `keepError: true` 인 이유: 오류는 판정이 돌려준 갱신 함수가 `setErrors` 로 다룬다.
    `setValue` 의 기본 동작("사용자가 고쳤다" → 그 필드 오류 삭제)이 겹치면 판정이 둘로 갈린다.
  */
  const applyResendOutcome = useCallback(
    (outcome: ResendOutcome) => {
      const next = codeStepAfterResend(outcome)
      codeForm.setErrors(next.errors)
      if (next.clearCode) codeForm.setValue('code', '', { keepError: true })
    },
    [codeForm.setErrors, codeForm.setValue],
  )

  const handleResend = useCallback(() => {
    // 쿨다운 가드에 더해 재진입 가드(ref)를 겹친다 — disabled 반영 전 빠른 연속
    // 클릭으로 sendEmailCode 가 중복 호출되는 것을 막는다 (form-guide.md §6)
    if (cooldownSeconds > 0 || resendingRef.current) return
    resendingRef.current = true
    setResending(true)
    setCodeAction('resend')
    let result: ResendResult = 'failed'
    void sendEmailCode(email)
      .then(() => {
        result = 'sent'
        setCooldownStartedAt(Date.now())
        setCodeErrorStatus(null)
        /*
          직전 폼 전체 실패(#1102)와 코드 칸 오류 · 값(#1109)을 걷는다. 남기면 성공한 재전송 위에
          앞선 429 문구("잠시 후 다시 요청해주세요")나 5xx 서버 문구가 알림으로 다시 서고(상태를
          비웠으니 일시 장애가 아니라 알림이 된다), 새 코드를 받을 칸에 "인증코드가 일치하지
          않습니다" 와 무효가 된 옛 코드가 남는다.
        */
        applyResendOutcome({ result: 'sent' })
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === 'rate-limited') {
          // 쿨다운을 유지해 재전송 버튼을 계속 비활성 상태로 둔다(D4). ErrorState 가
          // 아니라 FormAlert 로만 보여준다 — codeForm 오류에 실어 CodeStep 이 그대로 렌더한다.
          // 상태도 429 로 둔다 (#1102) — 직전 5xx 상태가 남아 있으면 이 알림이 일시 장애에 가린다
          setCooldownStartedAt(Date.now())
          setCodeErrorStatus(error.status)
          // 코드 칸 오류 · 값은 남기고 429 문구를 얹는다 — 새 코드가 오지 않았다 (#1109)
          applyResendOutcome({
            result: 'failed',
            failure: apiErrorToFormErrors(error, messages.form.submitFailed),
          })
          return
        }
        setCodeErrorStatus(error instanceof ApiError ? error.status : NO_RESPONSE_STATUS)
        // 5xx · 무응답 — 코드 칸은 그대로, 일시 장애는 상태 코드가 세운다 (#1109)
        applyResendOutcome({ result: 'failed', failure: null })
      })
      .finally(() => {
        resendingRef.current = false
        setResending(false)
        /*
          `loading` 이 풀리는 **같은 렌더**에서 센다 — 요청 중에는 `FormFailure` 가 직전 실패를
          걷어(`submitting || resending`) effect 가 찾을 알림이 아직 없다.
        */
        setResendOutcome((previous) => ({ count: previous.count + 1, result }))
      })
  }, [cooldownSeconds, email, applyResendOutcome])

  /*
    **재전송 뒤 포커스** (#1102). 재전송 버튼은 요청 중 `loading`, 끝나면 성공이든 429 든 쿨다운으로
    `disabled` 라 포커스가 `BODY` 로 떨어졌다(실측: 성공 · 429 · 503 모두). 성공이면 코드 칸,
    막혔으면 제출 실패와 같은 순서(429 알림 · 5xx 일시 장애)다 — `resendFocusTargets`.
    성공은 포커스를 잃었을 때만 옮긴다(요청 중에 코드 칸을 눌러 둔 사람의 자리를 빼앗지 않는다) —
    `focusResendResult`.
  */
  useEffect(() => {
    if (resendOutcome.count === 0 || step !== 'code') return
    focusResendResult(containerRef.current, resendOutcome.result, codeForm.errors, codeErrorStatus)
  }, [resendOutcome])

  /**
   * 동의 값을 바꾸면 그 항목의 오류만 지운다. `useForm.setValue` 의 기본 동작과 같은
   * 판단이다 — 전체를 지우면 아직 켜지 않은 항목의 안내까지 사라진다.
   */
  const handleConsentChange = useCallback(
    (key: SignupConsentKey, checked: boolean) => {
      setConsentErrors((previous) => clearConsentErrors(previous, [key]))
      onConsentChange(key, checked)
    },
    [onConsentChange],
  )

  /** 전체 동의는 세 값을 한꺼번에 바꾸므로 세 항목의 오류를 함께 지운다 (#1083) */
  const handleConsentAllChange = useCallback(
    (checked: boolean) => {
      setConsentErrors((previous) => clearConsentErrors(previous, SIGNUP_CONSENT_KEYS))
      onConsentAllChange(checked)
    },
    [onConsentAllChange],
  )

  /**
   * 3단계 제출.
   *
   * **동의는 이미 받았다** — 1단계 첫 발송이 약관 시트를 거친다 (#1284). 그래도 클라이언트 검증은
   * 남긴다(form-guide.md §5 "백엔드 제약의 복제본"): 빠져 있으면 보내지 않고 시트를 다시 띄운다.
   * 프로필 오류도 같은 제출에서 함께 보인다 — 시트를 닫으면 바로 칸 아래 오류가 서 있다.
   */
  const handleProfileSubmit = useCallback(() => {
    const consentResult = validate(signupConsentSchema, consent)
    if (consentResult.ok) {
      setConsentErrors(NO_FORM_ERRORS)
      void profileForm.submit()
      return
    }

    const profileResult = validate(signupProfileSchema, profileForm.values)
    profileForm.setErrors(profileResult.ok ? NO_FORM_ERRORS : profileResult.errors)
    setConsentErrors(consentResult.errors)
    setConsentSheet('signup')
  }, [consent, profileForm.submit, profileForm.setErrors, profileForm.values])

  /**
   * 1단계 `인증코드 받기` (#1284).
   *
   * **동의가 없으면 보내지 않고 약관 시트를 띄운다** — 코드 발송이 이메일을 서버로 보내는 첫 요청이다.
   * 단, **이메일 칸이 틀렸으면 시트보다 칸 오류가 먼저다**: 시트에 동의하고 나서야 "이메일 형식이
   * 아니에요" 를 보면 동의가 헛수고로 읽힌다. 그 판정은 `useForm` 의 검증에 맡긴다 — 틀린 값이면
   * `submit` 이 요청 없이 오류만 세우고 포커스 effect 가 칸으로 옮긴다.
   *
   * 한 번 동의하면 이메일을 고쳐 다시 보낼 때는 바로 나간다 — 동의 값은 `SignupScreen` 이 들고 있다.
   */
  const handleEmailSubmit = useCallback(() => {
    if (isSignupConsentComplete(consent) || !validate(emailSchema, emailForm.values).ok) {
      void emailForm.submit()
      return
    }
    setConsentSheet('sendCode')
  }, [consent, emailForm.submit, emailForm.values])

  /** 시트의 실행 버튼 — 닫고 하려던 일을 잇는다 */
  const handleConsentConfirm = useCallback(() => {
    const purpose = consentSheet
    // 포커스는 이어지는 제출의 결과(단계 전환 · 실패 포커스 effect)가 정한다 — 복귀 자리를 따로 두지 않는다
    consentReturnFocusRef.current = null
    setConsentSheet(null)
    if (purpose === 'sendCode') void emailForm.submit()
    if (purpose === 'signup') handleProfileSubmit()
  }, [consentSheet, emailForm.submit, handleProfileSubmit])

  const emailStepErrors: FormErrors =
    stepBackMessage !== null
      ? { fields: emailForm.errors.fields, form: stepBackMessage }
      : emailForm.errors

  /*
    동의 오류가 체크박스에 붙었으면 폼 전체 오류는 끈다 — 같은 문구가 `FormAlert` 와
    체크박스 아래에 두 번 보인다. "필드 오류가 잡혔으면 대표 메시지를 또 띄우지 않는다"는
    `field-errors.ts` 의 판단을 동의 블록 너머로 이은 것이다.
  */
  const profileStepErrors: FormErrors = hasConsentErrors(consentErrors)
    ? { fields: profileForm.errors.fields, form: null }
    : profileForm.errors

  /*
    **1 · 3단계 제출 실패 뒤 포커스** (#1078). 2단계는 위 `codeForm` effect 가 맡는다.

    예전에는 둘 다 effect 가 없었다 — 1단계를 빈 채로 내면 포커스가 버튼에 남았고, 3단계 409
    (`MEMBER_001`)는 제출 중 `disabled` 가 된 버튼에서 포커스가 `BODY` 로 떨어졌다. 대상 순서는
    `focusSubmitFailure` 하나가 정한다: 첫 오류 필드 → 폼 전체 알림(5xx 면 폼 안 일시 장애,
    #1079) → 폼의 첫 입력.

    트리거는 `submitCount` 하나다 (`use-form.ts` JSDoc). **화면에 보이는 오류**를 넘긴다 —
    1단계는 되돌림 안내가 섞인 값, 3단계는 동의 오류가 붙은 값이다. 상태 코드도 화면
    (`FormFailure`)에 넘기는 것과 같은 값이다.

    단계 가드: 3단계의 `MEMBER_006` 은 1단계로 되돌리고, 그 이동은 단계 전환 effect 가
    이메일 칸으로 옮긴다(D6). 여기서 또 옮기면 되돌림 알림과 이메일 칸이 포커스를 다툰다.
  */
  useEffect(() => {
    if (emailForm.submitCount === 0 || step !== 'email') return
    focusSubmitFailure(containerRef.current, emailStepErrors, emailErrorStatus)
  }, [emailForm.submitCount])

  useEffect(() => {
    if (profileForm.submitCount === 0 || step !== 'profile') return
    // 동의 거부면 시트가 떠 있다 — 시트가 포커스를 갖는다(`BottomSheet` 의 `useOverlay`). 뺏지 않는다
    if (hasConsentErrors(consentErrors)) return
    /*
      서버가 돌려준 동의 오류(`MEMBER_115/116/117` · `MEMBER_010/011`)도 같은 제출의 결과다.
      프로필 오류와 합쳐 넘기면 `focusFirstError` 가 문서 순서로 고른다 — 동의 블록이 위다.
    */
    focusSubmitFailure(
      containerRef.current,
      {
        fields: { ...profileStepErrors.fields, ...consentErrors.fields },
        form: profileStepErrors.form,
      },
      profileErrorStatus,
    )
  }, [profileForm.submitCount])

  /**
   * 시트를 동의 없이 닫는다 — Esc · 바깥 누름 (#1295 N2).
   *
   * **3단계에서 뜬 시트는 첫 오류 칸 → `가입하기` 로 돌아간다.** 서버가 동의를 거부해 다시 띄운 시트는
   * 제출 응답이 연 것이라, 열린 순간의 활성 요소가 `BODY` 였다(제출 중 `가입하기` 가 `disabled`).
   * 그대로 두면 닫은 뒤 `BODY` 로 떨어지고, 프로필 실패 포커스 effect 는 동의 오류가 있어 비켜 서
   * 있다(#1078 이 실측한 그 자리). 1단계 시트는 `인증코드 받기` 를 누른 채 열려 그 버튼으로 잘 돌아가므로
   * 예전대로 둔다.
   */
  const handleConsentSheetClose = () => {
    consentReturnFocusRef.current =
      consentSheet === 'signup'
        ? returnFocusTarget<HTMLElement>(containerRef.current, profileStepErrors)
        : null
    setConsentSheet(null)
  }

  /*
    **약관 시트** (#1284). 동의 블록은 더 이상 단계 위에 서지 않는다 — 첫 발송 전과 서버 거부 때만
    시트로 뜬다(`SignupConsentSheet` 머리주석). 시트는 body 포털이라 어느 단계 아래 두어도 같다.
  */
  const consentSheetElement = (
    <SignupConsentSheet
      open={consentSheet !== null}
      onClose={handleConsentSheetClose}
      triggerRef={consentReturnFocusRef}
      consent={consent}
      errors={consentErrors}
      onConsentChange={handleConsentChange}
      onConsentAllChange={handleConsentAllChange}
      action={
        <SignupConsentAction
          complete={isSignupConsentComplete(consent)}
          label={
            consentSheet === 'signup'
              ? messages.auth.consentAndSignup
              : messages.auth.consentAndSendCode
          }
          requiredMessage={
            consentSheet === 'signup'
              ? messages.auth.signupConsentRequired
              : messages.auth.emailConsentRequired
          }
          onConfirm={handleConsentConfirm}
        />
      }
    />
  )

  /**
   * 2 · 3단계의 `←` — 이메일부터 다시. 코드 · 쿨다운을 비운다("이메일 다시 입력" 과 같다).
   * **입력한 프로필도 버린다** — 이메일이 바뀌면 다른 계정이다(D14 · D4 의 409 처리와 같은 판단).
   * 남겨 두면 다른 이메일로 인증한 뒤 앞 계정용 비밀번호 · 이름이 채워진 채 3단계가 열린다.
   * 동의(`consent`)는 계정이 아니라 사람의 것이라 남긴다.
   */
  const backToEmail = () => {
    codeForm.reset()
    profileForm.reset()
    setConsentErrors(NO_FORM_ERRORS)
    setProfileErrorStatus(null)
    setCooldownStartedAt(null)
    setCodeErrorStatus(null)
    setStep('email')
  }

  if (step === 'email') {
    return (
      <div ref={containerRef} className="flex flex-col gap-4">
        <AuthTopBar back={{ onClick: onExit }} backLabel={messages.auth.signupBackToMethod} />
        <SignupStepHeading
          step={1}
          heading={messages.auth.signupEmailHeading}
          description={messages.auth.signupEmailDescription}
        />
        <EmailStep
          values={emailForm.values}
          errors={emailStepErrors}
          errorStatus={emailErrorStatus}
          submitting={emailForm.isSubmitting}
          // 되돌림 안내는 단계 전환 effect 가 이메일 칸으로 옮긴다(D6) — 알림이 낭독 경로다 (#1102)
          announce={stepBackMessage !== null ? 'live' : undefined}
          onValueChange={(key, value) => {
            setStepBackMessage(null)
            // 입력을 고치면 5xx/무응답의 일시 장애 표시를 걷는다 — I1 과 동일한 패턴.
            // 서버 문구도 함께 걷는다 — 남기면 그 문구로 알림이 선다 (#1102)
            emailForm.setErrors((previous) => formErrorsAfterEdit(previous, emailErrorStatus))
            setEmailErrorStatus(null)
            emailForm.setValue(key, value)
          }}
          onSubmit={handleEmailSubmit}
          onRetry={() => void emailForm.submit()}
        />
        {consentSheetElement}
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div ref={containerRef} className="flex flex-col gap-4">
        <AuthTopBar back={{ onClick: backToEmail }} backLabel={messages.auth.signupBackToEmail} />
        <SignupStepHeading step={2} heading={messages.auth.signupCodeHeading} />
        <CodeStep
          email={email}
          values={codeForm.values}
          errors={codeForm.errors}
          errorStatus={codeErrorStatus}
          submitting={codeForm.isSubmitting}
          cooldownSeconds={cooldownSeconds}
          resending={isResending}
          notice={messages.auth.codeSent}
          onValueChange={(key, value) => {
            // 입력을 고치면 5xx/무응답의 일시 장애 표시를 걷는다 — I1 과 동일한 패턴 (#1102 서버 문구도)
            codeForm.setErrors((previous) => formErrorsAfterEdit(previous, codeErrorStatus))
            setCodeErrorStatus(null)
            codeForm.setValue(key, value)
          }}
          onSubmit={() => void codeForm.submit()}
          onResend={handleResend}
          onChangeEmail={backToEmail}
          onRetry={() => (codeAction === 'resend' ? handleResend() : void codeForm.submit())}
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {/*
        3단계의 `←` 도 이메일부터 다시다 — 2단계로 돌아가 봐야 이미 쓴 코드뿐이다. 입력한 프로필은
        버린다: 이메일이 바뀌면 다른 계정이다(D4 의 409 처리와 같은 판단).
      */}
      <AuthTopBar back={{ onClick: backToEmail }} backLabel={messages.auth.signupBackToEmail} />
      <SignupStepHeading
        step={3}
        heading={messages.auth.signupProfileHeading}
        description={messages.auth.signupProfileDescription}
      />
      <ProfileStep
        email={email}
        values={profileForm.values}
        errors={profileStepErrors}
        errorStatus={profileErrorStatus}
        submitting={profileForm.isSubmitting || entering}
        duplicateEmail={duplicateEmail}
        returnTo={returnTo}
        // errors.form 이 있으면(409 포함) 성공 안내를 끈다 — 안 그러면 "이메일 인증이
        // 완료됐어요."(role=status) 와 오류(role=alert) 가 동시에 뜬다. 새 state 를
        // 늘리지 않고 이미 있는 errors.form 으로 판정한다 — 이슈 #24 최종 리뷰 M7.
        // 동의 오류로 막힌 경우에도 끈다 — 실패했는데 성공 안내가 남으면 안 된다.
        notice={
          profileStepErrors.form === null && !hasConsentErrors(consentErrors)
            ? messages.auth.codeVerified
            : undefined
        }
        onValueChange={(key, value) => {
          // duplicateEmail 은 여기서 지우지 않는다 — 409 이후에도 "로그인하기" 링크가
          // 계속 보여야 한다(정본 D4). 지우는 지점은 profileForm 의 다음 제출 결과
          // (성공 / 409 아닌 다른 오류)뿐이다 — 그 외에는 값을 고쳐도 이 화면에서
          // 할 수 있는 일이 없다(이메일은 1단계 값이라 여기서 못 바꾼다).
          // 입력을 고치면 5xx/무응답의 일시 장애 표시를 걷는다 — I1 과 동일한 패턴 (#1102 서버 문구도)
          profileForm.setErrors((previous) => formErrorsAfterEdit(previous, profileErrorStatus))
          setProfileErrorStatus(null)
          profileForm.setValue(key, value)
        }}
        onSubmit={handleProfileSubmit}
        onRetry={handleProfileSubmit}
      />
      {consentSheetElement}
    </div>
  )
}
