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
  /**
   * 실패로 끝난 제출 횟수. 성공 시에는 증가하지 않는다.
   *
   * 포커스 이동 effect 의 유일한 안정적인 트리거다. `errors`/`firstErrorField` 를
   * 의존성으로 쓰면 두 문제가 생긴다: (1) 오류가 여러 개 남은 상태에서 한 필드를
   * 고치면 `setValue` 가 그 필드 오류만 지워도 `errors` 객체가 바뀌어 effect 가
   * 다시 돌며 **입력 중인 필드에서 포커스를 훔친다.** (2) 같은 필드에 같은 오류가
   * 연속 두 번 나면 값이 안 바뀌어 두 번째 제출에서 포커스가 안 간다.
   * `submitCount` 는 "제출이 실패로 끝났다"는 이벤트 자체를 신호로 쓰므로 둘 다
   * 피한다 (react-hook-form 도 같은 방식).
   */
  submitCount: number
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
  const [submitCount, setSubmitCount] = useState(0)

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
      setSubmitCount((count) => count + 1)
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
      setSubmitCount((count) => count + 1)
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
    submitCount,
  }
}
