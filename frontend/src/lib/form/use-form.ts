'use client'

import { useCallback, useRef, useState } from 'react'

import type { ZodType } from 'zod'

import { apiErrorToFormErrors, type FormErrors, NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { validate } from '@/lib/form/validate'
import { messages } from '@/lib/messages'

export type UseFormOptions<TValues, TResult> = {
  schema: ZodType<TValues>
  initialValues: TValues
  onSubmit: (values: TValues) => Promise<TResult>
  onSuccess?: (result: TResult, values: TValues) => void
}

export type UseFormReturn<TValues> = {
  values: TValues
  errors: FormErrors
  isSubmitting: boolean
  isDirty: boolean
  setValue: <K extends keyof TValues>(key: K, value: TValues[K]) => void
  setErrors: (errors: FormErrors) => void
  reset: (values?: TValues) => void
  submit: () => Promise<void>
  /** 제출 실패 시 포커스를 옮길 대상 */
  firstErrorField: string | null
}

/**
 * 폼 상태 배선. **로직은 순수 함수에 있다** — docs/form-guide.md §2.
 *
 * React Query 를 모른다. `onSubmit` 으로 `mutateAsync` 를 받는다.
 * 그래야 캐시 무효화·이동 같은 부수효과가 호출부 책임으로 남는다.
 */
export function useForm<TValues extends Record<string, unknown>, TResult>({
  schema,
  initialValues,
  onSubmit,
  onSuccess,
}: UseFormOptions<TValues, TResult>): UseFormReturn<TValues> {
  const [values, setValues] = useState<TValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>(NO_FORM_ERRORS)
  const [isSubmitting, setSubmitting] = useState(false)
  const [isDirty, setDirty] = useState(false)

  // disabled 가 반영되기 전에 Enter 제출이 두 번 들어갈 수 있다.
  // 버튼 disabled 와 이 가드를 **둘 다** 건다 — docs/form-guide.md §6
  const submittingRef = useRef(false)

  const setValue = useCallback(<K extends keyof TValues>(key: K, value: TValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }))
    setDirty(true)
    // 고친 필드의 오류만 지운다. 전체를 지우면 아직 안 고친 필드의 안내가 사라진다
    setErrors((previous) => {
      if (previous.fields[key as string] === undefined) return previous
      const fields = { ...previous.fields }
      delete fields[key as string]
      return { fields, form: previous.form }
    })
  }, [])

  const reset = useCallback(
    (next?: TValues) => {
      setValues(next ?? initialValues)
      setErrors(NO_FORM_ERRORS)
      setDirty(false)
    },
    [initialValues],
  )

  const submit = useCallback(async () => {
    if (submittingRef.current) return

    const result = validate(schema, values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      const submitted = await onSubmit(result.data)
      setErrors(NO_FORM_ERRORS)
      setDirty(false)
      onSuccess?.(submitted, result.data)
    } catch (error) {
      // 클라이언트 오류와 합치지 않고 교체한다. 합치면 이미 고친 필드의
      // 낡은 오류가 남는다 — docs/form-guide.md §5
      setErrors(apiErrorToFormErrors(error, messages.form.submitFailed))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [onSubmit, onSuccess, schema, values])

  const firstErrorField = Object.keys(errors.fields)[0] ?? null

  return {
    values,
    errors,
    isSubmitting,
    isDirty,
    setValue,
    setErrors,
    reset,
    submit,
    firstErrorField,
  }
}
