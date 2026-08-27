'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { login, type LoginResult } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/error'
import type { FormErrors } from '@/lib/form/field-errors'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'

export type LoginFormFieldsProps = {
  values: LoginValues
  errors: FormErrors
  isSubmitting: boolean
  showPassword: boolean
  onValueChange: (key: keyof LoginValues, value: string) => void
  onTogglePassword: () => void
  onSubmit: () => void
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
  isSubmitting,
  showPassword,
  onValueChange,
  onTogglePassword,
  onSubmit,
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

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
        {isSubmitting ? messages.auth.loginSubmitting : messages.auth.loginSubmit}
      </Button>
    </form>
  )
}

export function LoginForm({ returnTo, initialEmail }: { returnTo: string; initialEmail: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)

  // 필드로 좁혀지지 않는 401(AUTH_006) 을 구분하기 위한 값.
  // useForm 의 onSubmit 클로저 안에서만 상태 코드를 볼 수 있어 ref 에 잠시 담는다.
  const lastErrorStatusRef = useRef<number | null>(null)
  // 첫 오류 필드로 포커스를 옮기기 위한 컨테이너 — 필드 id 로 실제 입력 요소를 찾는다.
  const formContainerRef = useRef<HTMLDivElement>(null)

  const { values, errors, isSubmitting, setValue, submit, firstErrorField } = useForm<
    LoginValues,
    LoginResult
  >({
    schema: loginSchema,
    initialValues: { email: initialEmail, password: '' },
    onSubmit: async (submitted) => {
      try {
        return await login(submitted)
      } catch (error) {
        lastErrorStatusRef.current = error instanceof ApiError ? error.status : null
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

  useEffect(() => {
    if (firstErrorField !== null) {
      formContainerRef.current?.querySelector<HTMLElement>(`#${firstErrorField}`)?.focus()
      return
    }

    // 이메일/비밀번호 불일치(AUTH_006)는 필드를 특정하지 못하는 폼 전체 오류로 온다.
    // 오타는 대개 비밀번호 쪽이라 비밀번호만 비우고 이메일은 남긴다.
    if (lastErrorStatusRef.current === 401) {
      setValue('password', '')
    }
    lastErrorStatusRef.current = null
  }, [errors, firstErrorField, setValue])

  return (
    <div ref={formContainerRef} className="flex flex-col gap-6">
      <h1 className="text-title-1 text-fg font-bold">{messages.auth.loginTitle}</h1>
      <LoginFormFields
        values={values}
        errors={errors}
        isSubmitting={isSubmitting}
        showPassword={showPassword}
        onValueChange={(key, value) => setValue(key, value)}
        onTogglePassword={() => setShowPassword((previous) => !previous)}
        onSubmit={() => void submit()}
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
