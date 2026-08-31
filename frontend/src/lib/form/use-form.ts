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
  /**
   * `keepError: true` 면 이 필드의 기존 오류를 지우지 않는다.
   *
   * 기본(생략)은 "사용자가 고쳤다" — 오류를 지운다. 프로그램이 값을 비운 것뿐이고
   * 방금 표시한 오류는 유지해야 하는 경우(예: 코드 불일치 후 코드만 비우고 재입력을
   * 유도하는 흐름)에만 `keepError: true` 를 쓴다. 안 그러면 이 호출이 바로 뒤이어
   * 오류를 지워버려 사용자가 "왜 실패했는지" 볼 수 없는 무음 실패가 된다 —
   * signup-form.tsx 의 AUTH_004(코드 불일치) 처리가 실측으로 겪은 버그.
   * 새 필드-비우기 흐름을 추가할 때(#12 반려견 폼 포함) 이 구분을 잊지 않는다.
   */
  setValue: <K extends keyof TValues>(
    key: K,
    value: TValues[K],
    options?: { keepError?: boolean },
  ) => void
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

  const setValue = useCallback(
    <K extends keyof TValues>(key: K, value: TValues[K], options?: { keepError?: boolean }) => {
      setValues((previous) => ({ ...previous, [key]: value }))
      setDirty(true)
      // keepError: 프로그램이 값을 비운 것뿐이라 방금 표시한 오류를 유지해야 한다
      // (위 UseFormReturn.setValue JSDoc 참고). 기본은 "사용자가 고쳤다" — 고친
      // 필드의 오류만 지운다. 전체를 지우면 아직 안 고친 필드의 안내가 사라진다
      if (options?.keepError === true) return
      setErrors((previous) => {
        if (previous.fields[key as string] === undefined) return previous
        const fields = { ...previous.fields }
        delete fields[key as string]
        return { fields, form: previous.form }
      })
    },
    [],
  )

  /*
    `initialValues` 를 의존성이 아니라 ref 로 읽는다 — **`reset` 을 항상 안정된 함수로
    유지하기 위해서다.**

    호출부는 대부분 `initialValues={{ nickname: member.nickname }}` 처럼 객체 리터럴을
    넘긴다. 그러면 매 렌더마다 새 객체가 되어 `[initialValues]` 의존 `reset` 도 매번
    새 함수가 되고, `reset` 을 effect 의존성에 넣은 호출부는 **effect → setState →
    리렌더 → effect** 무한 루프에 빠진다 ("Maximum update depth exceeded").
    렌더 테스트는 effect 를 돌리지 않으므로 이 버그를 잡지 못한다 — 브라우저 실측으로
    잡았다 (#83 프로필 수정 모달).

    ref 는 매 렌더 최신값으로 갱신되므로 인자 없는 `reset()` 의 동작은 그대로다.
  */
  const initialValuesRef = useRef(initialValues)
  initialValuesRef.current = initialValues

  const reset = useCallback((next?: TValues) => {
    setValues(next ?? initialValuesRef.current)
    setErrors(NO_FORM_ERRORS)
    setDirty(false)
  }, [])

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
