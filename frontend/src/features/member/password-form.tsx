'use client'

import { useEffect, useRef } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { PasswordFormFields, type PasswordFormMode } from '@/features/member/password-form-fields'
import { memberKeys } from '@/features/member/queries'
import {
  passwordChangeSchema,
  type PasswordFormValues,
  passwordSetupSchema,
} from '@/features/member/schemas'
import { useSessionExit } from '@/features/member/use-session-exit'
import { changePassword, setupPassword } from '@/lib/api/member'
import { useForm } from '@/lib/form/use-form'

/**
 * 비밀번호 변경 / 최초 설정.
 *
 * **성공 뒤처리가 두 모드에서 완전히 다르다** — 서버 계약이 다르기 때문이다:
 *
 * | 모드 | 서버 동작 | 화면 |
 * | ---- | --------- | ---- |
 * | `change` | refresh 쿠키를 **지운다** | 세션 정리 → `/login` |
 * | `setup`  | 쿠키를 건드리지 않는다 | `memberKeys.me()` invalidate (`hasPassword` 가 바뀐다) |
 *
 * `change` 를 invalidate 로만 끝내면 화면은 로그인된 것처럼 남아 있다가 다음 조작에서
 * 401 을 맞는다 — `use-session-exit.ts` 주석 참고.
 *
 * `setup` 은 이 화면에 머물지만 **폼이 변경 폼으로 바뀐다.** `hasPassword` 가 true 가
 * 되어 계정 상태가 `social-only` → `linked` 로 넘어가기 때문이고, 그것이 맞는 결과다.
 */
export function PasswordForm({ mode }: { mode: PasswordFormMode }) {
  const exitSession = useSessionExit()
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)

  const { values, errors, isSubmitting, setValue, submit, firstErrorField, submitCount } = useForm<
    PasswordFormValues,
    void
  >({
    schema: mode === 'change' ? passwordChangeSchema : passwordSetupSchema,
    initialValues: { currentPassword: '', newPassword: '' },
    onSubmit: async (submitted) => {
      if (mode === 'change') {
        await changePassword({
          currentPassword: submitted.currentPassword,
          newPassword: submitted.newPassword,
        })
        return
      }
      // 최초 설정에는 현재 비밀번호가 없다 — 요청 DTO 에 필드 자체가 없다
      await setupPassword({ newPassword: submitted.newPassword })
    },
    onSuccess: () => {
      if (mode === 'change') {
        exitSession('password-changed')
        return
      }
      void queryClient.invalidateQueries({ queryKey: memberKeys.me() })
    },
  })

  // submitCount 만 의존한다 — 입력 중 setValue 가 errors 를 새로 만들 때마다 effect 가
  // 다시 돌아 타이핑 중인 필드에서 포커스를 훔치는 것을 피한다.
  // 근거는 use-form.ts 의 submitCount 주석.
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    containerRef.current?.querySelector<HTMLElement>(`#${firstErrorField}`)?.focus()
  }, [submitCount])

  return (
    <div ref={containerRef}>
      <PasswordFormFields
        mode={mode}
        currentPassword={values.currentPassword}
        newPassword={values.newPassword}
        errors={errors}
        submitting={isSubmitting}
        onCurrentPasswordChange={(value) => setValue('currentPassword', value)}
        onNewPasswordChange={(value) => setValue('newPassword', value)}
        onSubmit={() => void submit()}
      />
    </div>
  )
}
