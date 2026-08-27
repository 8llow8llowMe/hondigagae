'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { login, type LoginResult } from '@/lib/api/auth'
import { ApiError, classify, NO_RESPONSE_STATUS } from '@/lib/api/error'
import type { FormErrors } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'

export type LoginFormFieldsProps = {
  values: LoginValues
  errors: FormErrors
  /** 실패한 요청의 HTTP 상태. 성공했거나 아직 요청을 보내지 않았으면 null */
  errorStatus: number | null
  submitting: boolean
  showPassword: boolean
  onValueChange: (key: keyof LoginValues, value: string) => void
  onTogglePassword: () => void
  onSubmit: () => void
  onRetry: () => void
}

/**
 * 표시 전용. 상태를 갖지 않아 node 환경에서 렌더 테스트가 된다
 * — docs/testing-guide.md §1.
 *
 * 비밀번호 표시 토글은 아이콘이 아니라 텍스트 버튼이다. `Button` 의 `iconOnly`
 * 는 타입으로 `children` 을 금지하고(component-guide.md §7), 아직 아이콘 SVG
 * 자산이 없어 `iconOnly` 를 쓰면 빈 버튼이 된다. `aria-pressed` 로 상태를 알린다.
 */
export function LoginFormFields({
  values,
  errors,
  errorStatus,
  submitting,
  showPassword,
  onValueChange,
  onTogglePassword,
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
          value={values.email}
          onValueChange={(value) => onValueChange('email', value)}
          invalid={errors.fields.email !== undefined}
        />
      </Field>

      <Field
        id="password"
        label={messages.auth.passwordLabel}
        error={errors.fields.password}
        required
      >
        <div className="flex gap-2">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={values.password}
            onValueChange={(value) => onValueChange('password', value)}
            invalid={errors.fields.password !== undefined}
          />
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
        {submitting ? messages.auth.loginSubmitting : messages.auth.loginSubmit}
      </Button>
    </form>
  )
}

export function LoginForm({ returnTo, initialEmail }: { returnTo: string; initialEmail: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)

  // 필드로 좁혀지지 않는 응답(401 / 429 / 5xx)을 구분하기 위한 값.
  // FormErrors 는 메시지만 담고 상태 코드를 담지 않아 별도로 추적한다.
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  // 첫 오류 필드·비밀번호 재포커스에 쓴다 — 필드 id 로 실제 입력 요소를 찾는다.
  const formContainerRef = useRef<HTMLDivElement>(null)

  const { values, errors, isSubmitting, setValue, submit, firstErrorField, submitCount } = useForm<
    LoginValues,
    LoginResult
  >({
    schema: loginSchema,
    initialValues: { email: initialEmail, password: '' },
    onSubmit: async (submitted) => {
      try {
        const result = await login(submitted)
        setErrorStatus(null)
        return result
      } catch (error) {
        // ApiError 가 아니면 전송 단계 실패(무응답)로 본다 — src/lib/api/error.ts 의 관례와 같다
        setErrorStatus(error instanceof ApiError ? error.status : NO_RESPONSE_STATUS)
        throw error
      }
    },
    onSuccess: () => {
      // 이전 사용자 캐시가 남으면 다른 계정의 데이터가 보인다
      queryClient.clear()
      // push 를 쓰면 뒤로가기로 로그인 화면에 돌아온다
      router.replace(returnTo)
    },
  })

  // submitCount 만 의존한다. errors/firstErrorField 를 넣으면 입력 중 setValue 가
  // 남은 필드 오류를 지우며 errors 객체를 새로 만들 때마다 effect 가 다시 돌아
  // 타이핑 중인 필드에서 포커스를 훔친다. submitCount 는 "제출이 실패로 끝났다"
  // 는 이벤트만 신호로 쓰므로 이 문제와, 같은 오류가 연속될 때 값이 안 바뀌어
  // 재실행이 안 되는 문제를 동시에 피한다 — use-form.ts 의 submitCount 주석 참고.
  useEffect(() => {
    if (submitCount === 0) return

    if (firstErrorField !== null) {
      formContainerRef.current?.querySelector<HTMLElement>(`#${firstErrorField}`)?.focus()
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

  return (
    <div ref={formContainerRef} className="flex flex-col gap-6">
      <h1 className="text-title-1 text-fg font-bold">{messages.auth.loginTitle}</h1>
      <LoginFormFields
        values={values}
        errors={errors}
        errorStatus={errorStatus}
        submitting={isSubmitting}
        showPassword={showPassword}
        onValueChange={(key, value) => {
          // 5xx/무응답을 받으면 ErrorState 가 폼을 대체해 입력을 고칠 수단이 사라진다.
          // 값을 고치면 다시 폼으로 돌아오게 한다 — 로그인-세부명세.md D4/D5(폼은 그대로
          // 유지), 이슈 #24 최종 리뷰 I1.
          setErrorStatus(null)
          setValue(key, value)
        }}
        onTogglePassword={() => setShowPassword((previous) => !previous)}
        onSubmit={() => void submit()}
        onRetry={() => void submit()}
      />
      <Link
        href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
        className="text-body-2 text-brand-600 text-center underline"
      >
        {messages.auth.toSignup}
      </Link>
    </div>
  )
}
