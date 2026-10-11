import { ApiError } from '@/lib/api/error'
import { apiErrorToFormErrors, type FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 429 폼 알림에 남은 시간을 덧붙인다 (#1309). 순수 함수다.
 *
 * **서버 문구는 그대로 두고 뒤에 한 문장을 보탠다** — "인증코드 요청이 너무 잦습니다. 잠시 후 다시
 * 시도해주세요. 1분 뒤 다시 시도할 수 있어요." 서버 문구를 FE 가 다시 쓰지 않는다(form-guide §4).
 *
 * 덧붙이는 경우는 셋이 다 맞을 때뿐이다 — `ApiError` · 429 · `retryAfterSeconds` 가 있음. 헤더가 없으면
 * 지금 문구 그대로다. 폼 전체 문구(`form`)가 없으면(필드 오류로 갈렸으면) 붙일 자리가 없어 그대로 둔다.
 */
export function appendRetryAfter(errors: FormErrors, error: unknown): FormErrors {
  if (!(error instanceof ApiError) || error.status !== 429) return errors
  if (error.retryAfterSeconds === null || errors.form === null) return errors
  return { ...errors, form: `${errors.form} ${messages.form.retryAfter(error.retryAfterSeconds)}` }
}

/**
 * 공용 제출 실패 매핑에 남은 시간을 얹은 것 — `useForm` 의 `toErrors` 자리 (form-guide §4.3).
 * 429 가 아니면 공용 매핑(`apiErrorToFormErrors` + `submitFailed`)과 같다.
 */
export function toErrorsWithRetryAfter(error: unknown): FormErrors {
  return appendRetryAfter(apiErrorToFormErrors(error, messages.form.submitFailed), error)
}
