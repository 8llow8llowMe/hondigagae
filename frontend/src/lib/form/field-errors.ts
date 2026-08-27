import { ApiError } from '@/lib/api/error'

/**
 * 폼 오류의 단일 표현.
 *
 * 백엔드가 필드 오류(Bean Validation)와 폼 전체 오류(도메인 예외)를 모두
 * `resultMessage` 하나로 내려주기 때문에, 한 타입에 담되 자리를 나눈다
 * — docs/form-guide.md §3.
 */
export type FormErrors = {
  /** 필드명 → 표시할 메시지 1개 */
  fields: Record<string, string>
  /** 특정 필드에 귀속되지 않는 오류 */
  form: string | null
}

export const NO_FORM_ERRORS: FormErrors = { fields: {}, form: null }

/** 백엔드가 필드를 특정하지 못했을 때 쓰는 이름 (ValidationErrorSupport.UNKNOWN_FIELD) */
const UNKNOWN_FIELD = 'request'

type ValidationErrorItem = { field: string; message: string }

function isValidationErrorItem(value: unknown): value is ValidationErrorItem {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.field === 'string' && typeof record.message === 'string'
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * 백엔드 실패 응답의 `resultMessage` 를 폼 오류로 정규화한다.
 *
 * 계약은 두 가지다 (docs/form-guide.md §4.1)
 *  (a) Bean Validation → `{ message, errors: [{code, field, message}] }`
 *  (b) 도메인 예외     → 문자열
 *
 * **같은 필드에 오류가 여러 개면 첫 오류만 채택한다.** 백엔드
 * `ValidationErrorSupport` 가 (DTO 선언 순서 → 제약 우선순위 → 메시지)로 정렬해
 * 내려주므로, 뒤 항목으로 덮어쓰면 그 정렬이 통째로 무의미해진다.
 */
export function toFormErrors(raw: unknown, fallback: string): FormErrors {
  const asText = nonEmpty(raw)
  if (asText !== null) return { fields: {}, form: asText }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fields: {}, form: fallback }
  }

  const body = raw as { message?: unknown; errors?: unknown }
  const representative = nonEmpty(body.message) ?? fallback

  if (!Array.isArray(body.errors)) {
    return { fields: {}, form: representative }
  }

  const fields: Record<string, string> = {}
  for (const item of body.errors) {
    if (!isValidationErrorItem(item)) continue
    // 백엔드가 필드를 특정하지 못한 오류는 폼 전체 오류로 다룬다
    if (item.field === UNKNOWN_FIELD) continue
    if (fields[item.field] === undefined) fields[item.field] = item.message
  }

  // 필드 오류가 잡혔으면 대표 메시지를 또 띄우지 않는다 — 같은 내용이 두 번 보인다
  const form = Object.keys(fields).length > 0 ? null : representative

  return { fields, form }
}

/** 던져진 오류를 그대로 받아 폼 오류로 바꾼다 */
export function apiErrorToFormErrors(error: unknown, fallback: string): FormErrors {
  if (!(error instanceof ApiError)) return { fields: {}, form: fallback }
  return toFormErrors(error.rawMessage, fallback)
}
