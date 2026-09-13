import { ApiError } from '@/lib/api/error'
import type { ValidationErrorItem } from '@/types/api'

/**
 * 폼 오류의 단일 표현.
 *
 * 백엔드가 대표 메시지(`resultMessage`)와 필드 단위 오류(`fieldErrors`)를 두 키로
 * 나눠 내려주므로, 한 타입에 담되 자리를 나눈다 — docs/form-guide.md §3.
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

function isValidationErrorItem(
  value: unknown,
): value is Pick<ValidationErrorItem, 'field' | 'message'> {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.field === 'string' && typeof record.message === 'string'
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * 필드 오류 목록을 `fields` 맵으로 접는다.
 *
 * **같은 필드에 오류가 여러 개면 첫 오류만 채택한다.** 백엔드
 * `ValidationErrorSupport` 가 (DTO 선언 순서 → 제약 우선순위 → 메시지)로 정렬해
 * 내려주므로, 뒤 항목으로 덮어쓰면 그 정렬이 통째로 무의미해진다.
 */
function toFieldMap(items: readonly unknown[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const item of items) {
    if (!isValidationErrorItem(item)) continue
    // 백엔드가 필드를 특정하지 못한 오류는 폼 전체 오류로 다룬다
    if (item.field === UNKNOWN_FIELD) continue
    if (fields[item.field] === undefined) fields[item.field] = item.message
  }
  return fields
}

/**
 * 필드 맵과 대표 메시지를 합쳐 `FormErrors` 로 만든다.
 *
 * 필드 오류가 잡혔으면 대표 메시지를 또 띄우지 않는다 — 같은 내용이 두 번 보인다.
 */
function combine(fields: Record<string, string>, representative: string): FormErrors {
  return { fields, form: Object.keys(fields).length > 0 ? null : representative }
}

/**
 * 백엔드 실패 응답을 폼 오류로 정규화한다 — docs/form-guide.md §4.1.
 *
 * **`fieldErrors` 가 정본이다** (#491 · #501). 계약이 통일되면서 `resultMessage` 는
 * 오류 종류와 무관하게 항상 문자열이 됐고, 필드 목록은 `fieldErrors` 로 빠졌다.
 *
 * ```json
 * {"success":false,"resultCode":"PLACE_102",
 *  "resultMessage":"size는 50 이하만 가능합니다.",
 *  "fieldErrors":[{"code":"PLACE_102","field":"size","message":"size는 50 이하만 가능합니다."}]}
 * ```
 *
 * 두 번째 인자(`fieldErrors`)를 읽지 않고 `raw` 만 보면 **문자열이라 첫 줄에서 반환하고
 * `fields` 가 영원히 비는** 것이 이 함수가 한 번 겪은 결함이다.
 *
 * `{ message, errors }` 분기는 **옛 계약의 하위호환**이다. 배포 순서가 어긋난 서버나
 * 아직 이관되지 않은 mock 이 붙어 있을 때만 쓰인다. 계약이 완전히 정착하면 지운다.
 */
export function toFormErrors(
  raw: unknown,
  fallback: string,
  fieldErrors?: readonly unknown[] | null,
): FormErrors {
  const representative = nonEmpty(raw) ?? fallback

  // (1) 새 계약 — 필드 목록이 `resultMessage` 밖에 따로 온다
  if (Array.isArray(fieldErrors)) {
    return combine(toFieldMap(fieldErrors), representative)
  }

  // (2) 대표 메시지만 있는 실패 (도메인 예외 · 검증 아님)
  const asText = nonEmpty(raw)
  if (asText !== null) return { fields: {}, form: asText }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fields: {}, form: fallback }
  }

  // (3) 하위호환 — 옛 `{ message, errors: [...] }` 봉투
  const body = raw as { message?: unknown; errors?: unknown }
  const legacyRepresentative = nonEmpty(body.message) ?? fallback

  if (!Array.isArray(body.errors)) {
    return { fields: {}, form: legacyRepresentative }
  }

  return combine(toFieldMap(body.errors), legacyRepresentative)
}

/** 던져진 오류를 그대로 받아 폼 오류로 바꾼다 */
export function apiErrorToFormErrors(error: unknown, fallback: string): FormErrors {
  if (!(error instanceof ApiError)) return { fields: {}, form: fallback }
  return toFormErrors(error.rawMessage, fallback, error.fieldErrors)
}
