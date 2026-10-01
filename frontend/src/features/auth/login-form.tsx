'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { Field } from '@/components/field'
import { Input } from '@/components/input'
import { PasswordInput } from '@/components/password-input'
import { enterSession } from '@/features/auth/enter-session'
import { FormFailure } from '@/features/auth/form-failure'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { login, type LoginResult } from '@/lib/api/auth'
import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import {
  clearSavedLoginEmail,
  readSavedLoginEmail,
  resolveInitialLoginEmail,
  saveLoginEmail,
} from '@/lib/auth/saved-login-email'
import type { FormErrors } from '@/lib/form/field-errors'
import { focusFirstError, hasFieldErrors } from '@/lib/form/focus-first-error'
import { focusSubmitFailure } from '@/lib/form/submit-failure-focus'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'

export type LoginFormFieldsProps = {
  values: LoginValues
  errors: FormErrors
  /** 실패한 요청의 HTTP 상태. 성공했거나 아직 요청을 보내지 않았으면 null */
  errorStatus: number | null
  submitting: boolean
  /** "이메일 기억하기" 체크 상태 — 로그인-세부명세 D10 */
  remember: boolean
  /** 비밀번호 입력 중 Caps Lock 이 켜져 있는가. 키 이벤트가 알려 줄 때까지는 false */
  capsLock: boolean
  onValueChange: (key: keyof LoginValues, value: string) => void
  onRememberChange: (checked: boolean) => void
  onCapsLockChange: (on: boolean) => void
  onSubmit: () => void
  onRetry: () => void
}

/**
 * 표시 전용. 상태를 갖지 않아 node 환경에서 렌더 테스트가 된다
 * — docs/testing-guide.md §1.
 *
 * **비밀번호 칸은 공용 `PasswordInput` 이다** (#1080 이 남긴 로그인 이관을 #1081 에서 닫는다).
 * 눈 토글의 배선(`aria-label` · `aria-pressed` · `aria-controls` · 44×44 `ghost`)은 원래 이
 * 파일의 것을 그대로 옮긴 것이라 동작은 같다. 표시 상태는 컴포넌트가 갖는다 — 폼 값이 아니라
 * 칸의 표시 방식이라서다 (`password-input.tsx` 머리주석). 그래서 이 표시 전용 컴포넌트에서
 * `showPassword` · `onTogglePassword` prop 이 빠졌다.
 */
export function LoginFormFields({
  values,
  errors,
  errorStatus,
  submitting,
  remember,
  capsLock,
  onValueChange,
  onRememberChange,
  onCapsLockChange,
  onSubmit,
  onRetry,
}: LoginFormFieldsProps) {
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
        5xx·무응답은 일시 장애(재시도 있음), 그 밖의 폼 전체 오류는 서버 문구 알림 — **둘 중
        하나만** 선다 (#1079, 로그인-세부명세 D4/D5). 429(잠금)는 알림이다: 재시도 버튼을 주면
        잠금을 연장한다.

        **폼을 대체하지 않고 위에 얹는다.** early return 으로 폼을 통째로 갈아치우면 명세의
        "폼은 그대로 유지"(D4)를 어긴다 — 이메일 오타를 고칠 수단이 없어진다. `onValueChange`
        의 `setErrorStatus(null)` 도 입력 요소가 살아있어야 발동한다 — 이슈 #24 최종 리뷰 I1.
      */}
      <FormFailure message={errors.form} errorStatus={errorStatus} onRetry={onRetry} />

      <Field id="email" label={messages.auth.emailLabel} error={errors.fields.email} required>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          // 모바일 키보드의 엔터 자리에 "다음" 을 띄운다 — 이 칸 다음에 비밀번호가 온다 (L6)
          enterKeyHint="next"
          value={values.email}
          onValueChange={(value) => onValueChange('email', value)}
          invalid={errors.fields.email !== undefined}
        />
      </Field>

      <Field
        id="password"
        label={messages.auth.passwordLabel}
        error={errors.fields.password}
        /*
          Caps Lock 안내는 `hint` 자리다 (L6). 오류가 있으면 `Field` 가 오류를 먼저 보이는데,
          필드 오류는 "비밀번호는 필수입니다." 하나뿐이라 그때는 칸이 비어 Caps Lock 이
          원인일 수 없다 — 둘이 겹칠 일이 없다.
        */
        hint={capsLock ? messages.auth.capsLockOn : undefined}
        required
      >
        {/*
          Caps Lock 이벤트는 `PasswordInput` 이 `Input` 으로 그대로 넘기는 native prop 이라 공용
          컴포넌트를 고치지 않고 받는다.
        */}
        <PasswordInput
          id="password"
          autoComplete="current-password"
          // 마지막 칸이라 엔터가 곧 제출이다 — 키보드에 "이동" 대신 "완료" 성격을 준다 (L6)
          enterKeyHint="done"
          /*
            **키 이벤트에서만 읽는다.** Caps Lock 상태를 묻는 API 는 `getModifierState` 하나고,
            그것은 이벤트 객체에만 있다. 켠 채로 칸에 들어와도 첫 글자를 치는 순간 뜬다.
            keyup 도 듣는 이유: Caps Lock 키 자체를 누를 때 keydown 은 **바뀌기 전** 상태를
            주는 브라우저가 있다.
          */
          onKeyDown={(event) => onCapsLockChange(event.getModifierState('CapsLock'))}
          onKeyUp={(event) => onCapsLockChange(event.getModifierState('CapsLock'))}
          // 칸을 떠나면 끈다 — 다른 칸에서의 대소문자는 이 안내의 대상이 아니다
          onBlur={() => onCapsLockChange(false)}
          value={values.password}
          onValueChange={(value) => onValueChange('password', value)}
          invalid={errors.fields.password !== undefined}
        />
      </Field>

      {/*
        **비밀번호 바로 아래 한 줄** — 왼쪽 기억하기 · 오른쪽 비밀번호 찾기 (#1081). 둘 다
        "로그인하기 전에 손댈 것" 이라 제출 버튼 위에 선다. 예전에는 비밀번호 찾기가 폼 밖
        맨 아래에 있어, 비밀번호가 막힌 사람이 **소셜 버튼을 지나서야** 찾았다.

        `items-start` 다 — 체크박스 라벨이 길어져 줄이 바뀌어도 링크가 첫 줄에 붙어 있게.
      */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <Checkbox
            id="remember-email"
            label={messages.auth.rememberEmail}
            checked={remember}
            onCheckedChange={onRememberChange}
            className="min-w-0"
          />
          {/*
            비밀번호 찾기는 `returnTo` 를 이어받지 않는다. 재설정이 끝나면 전 기기 세션이
            무효화돼 어차피 로그인부터 다시 해야 하고(AuthWebController), 중간에 경로를
            들고 다니면 이메일이 오가는 화면에 쿼리를 하나 더 얹는 셈이다 — 정본 D3.

            누르는 자리는 `min-h-11` 로 체크박스 줄과 같은 44 다 (DESIGN.md §7 #905 R3).
          */}
          <Link
            href="/password/reset"
            className="text-body-2 text-fg-muted inline-flex min-h-11 shrink-0 items-center underline"
          >
            {messages.auth.forgotPassword}
          </Link>
        </div>
        {/*
          켰을 때만 보인다. **체크박스의 `description` 이 아니라 줄 전체 폭이다** — 왼쪽 칸에
          넣으면 375 에서 링크 몫을 뺀 폭으로 세 줄이 된다. `role` 을 달지 않는 것은 이것이
          오류가 아니라 상시 안내라서다 (`socialConsentRequired` 와 같은 판단).
        */}
        {remember && (
          <p className="text-caption text-fg-muted">{messages.auth.rememberEmailCaption}</p>
        )}
      </div>

      <Button type="submit" size="lg" loading={submitting}>
        {submitting ? messages.auth.loginSubmitting : messages.auth.loginSubmit}
      </Button>
    </form>
  )
}

export function LoginForm({ returnTo, initialEmail }: { returnTo: string; initialEmail: string }) {
  const queryClient = useQueryClient()
  /*
    **기본은 꺼짐이다** (#1081). 저장값은 마운트 뒤 effect 에서 읽어 켠다 — 서버 렌더에는
    `localStorage` 가 없고, 렌더 중에 읽으면 서버와 첫 클라이언트 렌더가 갈려 hydration
    불일치가 난다 (architecture-guide.md 클라이언트 경계).
  */
  const [remember, setRemember] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  /*
    **로그인이 성공한 뒤 이동이 끝날 때까지 버튼을 도는 채로 둔다.** `useForm` 의
    `isSubmitting` 은 `onSuccess` 가 돌자마자 내려가는데, 이동은 그 뒤에 시작돼 새 화면이
    뜨기 전 짧은 틈에 버튼이 다시 눌린다 — 두 번째 로그인 요청이 나간다. 성공은 되돌릴
    일이 없으므로 한 번 켜면 끄지 않는다 (이 컴포넌트는 이동과 함께 사라진다).
  */
  const [entering, setEntering] = useState(false)

  // 필드로 좁혀지지 않는 응답(401 / 429 / 5xx)을 구분하기 위한 값.
  // FormErrors 는 메시지만 담고 상태 코드를 담지 않아 별도로 추적한다.
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  // 첫 오류 필드·비밀번호 재포커스에 쓴다 — 필드 id 로 실제 입력 요소를 찾는다.
  const formContainerRef = useRef<HTMLDivElement>(null)

  const { values, errors, isSubmitting, setValue, submit, submitCount } = useForm<
    LoginValues,
    LoginResult
  >({
    schema: loginSchema,
    initialValues: { email: initialEmail, password: '' },
    onSubmit: async (submitted) => {
      try {
        const result = await login(submitted)
        setErrorStatus(null)
        setEntering(true)
        /*
          **성공한 이메일만 기억한다** (#1081). 여기가 성공 확정 지점이다 — `login()` 은
          실패하면 던지므로 오타 · 401 · `MEMBER_007`(소셜 전용 계정)은 이 줄에 오지 않는다.
          꺼져 있으면 아무것도 하지 않는다: 해제하는 순간 이미 지웠다 (`onRememberChange`).
        */
        if (remember) saveLoginEmail(submitted.email)
        return result
      } catch (error) {
        // ApiError 가 아니면 전송 단계 실패(무응답)로 본다 — src/lib/api/error.ts 의 관례와 같다
        setErrorStatus(error instanceof ApiError ? error.status : NO_RESPONSE_STATUS)
        throw error
      }
    },
    // 이동은 문서째 새로 받는다 — 라우터 캐시의 비로그인 응답을 버리려고다 (#1075, `enterSession`)
    onSuccess: () => enterSession({ queryClient, location: globalThis.location }, returnTo),
  })

  // submitCount 만 의존한다. errors 를 넣으면 입력 중 setValue 가
  // 남은 필드 오류를 지우며 errors 객체를 새로 만들 때마다 effect 가 다시 돌아
  // 타이핑 중인 필드에서 포커스를 훔친다. submitCount 는 "제출이 실패로 끝났다"
  // 는 이벤트만 신호로 쓰므로 이 문제와, 같은 오류가 연속될 때 값이 안 바뀌어
  // 재실행이 안 되는 문제를 동시에 피한다 — use-form.ts 의 submitCount 주석 참고.
  useEffect(() => {
    if (submitCount === 0) return

    // 대상은 DOM 순서로 고른다 — 스키마 키 선언 순서가 아니다 (#560)
    if (hasFieldErrors(errors)) {
      focusFirstError(formContainerRef.current, errors)
      return
    }

    // 이메일/비밀번호 불일치(401 AUTH_006)는 필드를 특정하지 못하는 폼 전체
    // 오류로 온다. 오타는 대개 비밀번호 쪽이라 비밀번호만 비우고 이메일은
    // 남기며, 비운 자리로 바로 포커스를 옮긴다 — 로그인-세부명세.md D4.
    if (errorStatus === 401) {
      setValue('password', '')
      formContainerRef.current?.querySelector<HTMLElement>('#password')?.focus()
      return
    }

    /*
      그 밖의 폼 전체 오류(5xx · 무응답 · 429 `AUTH_015` · 400 `MEMBER_007`)는 알림으로 보낸다
      (#1078). 5xx · 무응답이면 알림이 아니라 폼 안 일시 장애 표시다 (#1079) — 화면에 무엇이
      서는지를 같은 `errorStatus` 로 판정한다. 제출 중 버튼이 `disabled` 가 되며 포커스가 `BODY` 로 떨어지고, 돌려 보낼
      필드가 없어 거기 남았다 — 키보드 사용자가 문서 맨 위에서 다시 시작했다.
    */
    focusSubmitFailure(formContainerRef.current, errors, errorStatus)
  }, [submitCount])

  /*
    첫 화면 값 — `?email=` 쿼리 > 기억한 이메일 (`resolveInitialLoginEmail`). 쿼리 쪽은 서버
    렌더에 이미 들어가 있고, 여기서는 저장값으로 **빈 칸만** 채운다.

    **이메일이 채워져 있으면 비밀번호로 포커스를 옮긴다** (L1). 기억한 이메일이나 가입
    직후의 이메일로 들어온 사람에게 남은 일은 비밀번호 하나다. 빈 채로 온 사람은 건드리지
    않는다 — 이메일 칸에 포커스를 억지로 두면 모바일에서 키보드가 화면 절반을 덮은 채
    시작한다.

    마운트 때 한 번만 돈다. 의존성을 비워 두는 것이 의도다 — 입력 중에 다시 돌면 사용자가
    지운 이메일을 저장값으로 되살린다.
  */
  useEffect(() => {
    const initial = resolveInitialLoginEmail(initialEmail, readSavedLoginEmail())
    if (initial.email !== initialEmail) setValue('email', initial.email)
    setRemember(initial.remember)
    if (initial.email.length > 0) {
      formContainerRef.current?.querySelector<HTMLElement>('#password')?.focus()
    }
  }, [])

  return (
    <div ref={formContainerRef} className="flex flex-col gap-6">
      <h1 className="text-title-1 text-fg font-bold">{messages.auth.loginTitle}</h1>
      <LoginFormFields
        values={values}
        errors={errors}
        errorStatus={errorStatus}
        submitting={isSubmitting || entering}
        remember={remember}
        capsLock={capsLock}
        onValueChange={(key, value) => {
          // 값을 고치면 5xx/무응답의 일시 장애 표시를 걷는다 — 로그인-세부명세.md D4/D5(폼은 그대로
          // 유지), 이슈 #24 최종 리뷰 I1.
          setErrorStatus(null)
          setValue(key, value)
        }}
        onRememberChange={(checked) => {
          setRemember(checked)
          // 해제는 **즉시** 지운다 (#1081) — 로그인하지 않고 떠나도 이 기기에 남지 않게
          if (!checked) clearSavedLoginEmail()
        }}
        onCapsLockChange={setCapsLock}
        onSubmit={() => void submit()}
        onRetry={() => void submit()}
      />
    </div>
  )
}

/**
 * "또는" 구분선 — 이메일 로그인과 소셜 로그인 사이 (#1081).
 *
 * 선 둘은 장식이라 `aria-hidden` 이고, 글자만 읽힌다. `role="separator"` 를 달지 않는 것은
 * 스크린리더가 "구분선" 을 한 번 더 읽어 "또는" 과 겹치기 때문이다.
 */
export function LoginDivider() {
  return (
    <div className="text-caption text-fg-muted flex items-center gap-3">
      <span aria-hidden="true" className="bg-border h-px flex-1" />
      {messages.auth.loginDivider}
      <span aria-hidden="true" className="bg-border h-px flex-1" />
    </div>
  )
}

/**
 * 화면 맨 아래 "아직 회원이 아니신가요? 회원가입" (#1081).
 *
 * **소셜 버튼 아래다.** 회원가입은 이 화면의 목적이 아니라 출구라, 로그인 수단(이메일 ·
 * 소셜)을 다 지난 자리에 둔다. `returnTo` 를 물고 간다 — 가입 후 로그인하면 원래
 * 목적지로 돌아간다 (로그인-세부명세 D4).
 *
 * 링크는 `min-h-11` 로 누르는 자리를 44 로 둔다 (DESIGN.md §7 #905 R3).
 */
export function LoginSignupPrompt({ returnTo }: { returnTo: string }) {
  return (
    <p className="text-body-2 text-fg-muted flex flex-wrap items-center justify-center gap-x-2">
      {messages.auth.signupPrompt}
      <Link
        href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
        className="text-brand-600 inline-flex min-h-11 items-center font-medium underline"
      >
        {messages.auth.toSignup}
      </Link>
    </p>
  )
}
