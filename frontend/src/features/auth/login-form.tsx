'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { EyeIcon, EyeOffIcon } from '@/components/icons'
import { Input } from '@/components/input'
import { enterSession } from '@/features/auth/enter-session'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { login, type LoginResult } from '@/lib/api/auth'
import { ApiError, classify, NO_RESPONSE_STATUS } from '@/lib/api/error'
import {
  clearSavedLoginEmail,
  readSavedLoginEmail,
  resolveInitialLoginEmail,
  saveLoginEmail,
} from '@/lib/auth/saved-login-email'
import type { FormErrors } from '@/lib/form/field-errors'
import { focusFirstError, hasFieldErrors } from '@/lib/form/focus-first-error'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'

export type LoginFormFieldsProps = {
  values: LoginValues
  errors: FormErrors
  /** 실패한 요청의 HTTP 상태. 성공했거나 아직 요청을 보내지 않았으면 null */
  errorStatus: number | null
  submitting: boolean
  showPassword: boolean
  /** "이메일 기억하기" 체크 상태 — 로그인-세부명세 D10 */
  remember: boolean
  /** 비밀번호 입력 중 Caps Lock 이 켜져 있는가. 키 이벤트가 알려 줄 때까지는 false */
  capsLock: boolean
  onValueChange: (key: keyof LoginValues, value: string) => void
  onTogglePassword: () => void
  onRememberChange: (checked: boolean) => void
  onCapsLockChange: (on: boolean) => void
  onSubmit: () => void
  onRetry: () => void
}

/**
 * 표시 전용. 상태를 갖지 않아 node 환경에서 렌더 테스트가 된다
 * — docs/testing-guide.md §1.
 *
 * **비밀번호 표시 토글은 입력란 안 눈 아이콘이다.** 예전에는 `표시` / `숨기기` 텍스트
 * 버튼이 입력란 **옆에** 섰다 — `iconOnly` 가 타입으로 `children` 을 금지하는데
 * (component-guide.md §7) 그때는 눈 아이콘 자산이 없어 쓰면 빈 버튼이 됐기 때문이다.
 * 자산이 생겼으니(`EyeIcon` · `EyeOffIcon`) 원래 자리로 옮긴다: 버튼이 가져가던 44px +
 * gap 8px 가 입력란으로 돌아가 **입력란이 열 끝까지 선다.**
 *
 * **이름은 아이콘이 아니라 `aria-label` 이 준다** — 아이콘은 `aria-hidden` 이다.
 * `표시` / `숨기기` 두 글자는 옆에 입력란이 보일 때만 뜻이 통하므로, 소리로만 듣는
 * 쪽에는 `비밀번호 표시` / `비밀번호 숨기기` 로 대상까지 말한다. 상태는 그대로
 * `aria-pressed` 가 알린다.
 */
export function LoginFormFields({
  values,
  errors,
  errorStatus,
  submitting,
  showPassword,
  remember,
  capsLock,
  onValueChange,
  onTogglePassword,
  onRememberChange,
  onCapsLockChange,
  onSubmit,
  onRetry,
}: LoginFormFieldsProps) {
  // 5xx·무응답만 ErrorState 다. 게이트웨이가 죽었을 때 입력 오류로 오해하지 않게
  // 재시도 수단을 준다 — 로그인-세부명세.md D4/D5. 429(잠금)는 여기 포함하지 않는다:
  // classify(429) 는 'rate-limited' 라 시간이 지나야 풀리는데 재시도 버튼을 주면
  // 오히려 잠금을 연장한다 — 아래 FormAlert 경로로 그대로 둔다.
  //
  // **폼을 대체하지 않고 위에 얹는다.** early return 으로 폼을 통째로 갈아치우면
  // 명세의 "폼은 그대로 유지"(D4)를 어긴다 — 입력 필드가 사라져 이메일 오타를
  // 고칠 수단이 없어진다. `onValueChange` 의 `setErrorStatus(null)` 도 입력
  // 요소가 살아있어야 발동할 수 있다 — 이슈 #24 최종 리뷰 I1 재수정.
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
      <FormAlert message={errors.form} />

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
        <Input
          id="password"
          type={showPassword ? 'text' : 'password'}
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
          action={
            /*
              `ghost` 다 — 입력란 **안**에 서는 버튼이라 자기 면을 가지면 입력란 안에 상자가
              하나 더 생긴다. hover 에서만 `--band` 가 깔린다.

              `aria-controls` 로 어느 입력란을 여닫는지 잇는다. 텍스트 버튼일 때는 바로 옆에
              붙어 있어 자리가 그 관계를 말했지만, 아이콘은 입력란 안으로 들어가 시각적으로만
              붙어 있다.
            */
            <Button
              variant="ghost"
              size="md"
              iconOnly
              aria-label={showPassword ? messages.auth.passwordHide : messages.auth.passwordShow}
              aria-pressed={showPassword}
              aria-controls="password"
              leading={showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              onClick={onTogglePassword}
            />
          }
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
  const [showPassword, setShowPassword] = useState(false)
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
    }
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
        showPassword={showPassword}
        remember={remember}
        capsLock={capsLock}
        onValueChange={(key, value) => {
          // 5xx/무응답을 받으면 ErrorState 가 폼을 대체해 입력을 고칠 수단이 사라진다.
          // 값을 고치면 다시 폼으로 돌아오게 한다 — 로그인-세부명세.md D4/D5(폼은 그대로
          // 유지), 이슈 #24 최종 리뷰 I1.
          setErrorStatus(null)
          setValue(key, value)
        }}
        onTogglePassword={() => setShowPassword((previous) => !previous)}
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
