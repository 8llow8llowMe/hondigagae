import type { ZodType } from 'zod'

import type { FormErrors } from '@/lib/form/field-errors'

export type ValidateResult<T> = { ok: true; data: T } | { ok: false; errors: FormErrors }

/**
 * zod 스키마로 폼 값을 검증한다.
 *
 * **필드별 첫 issue 만 채택한다.** 서버 매핑(field-errors)과 같은 동작이어야
 * 클라이언트/서버 결과가 어긋나지 않는다 — docs/form-guide.md §5.
 *
 * 클라이언트 검증은 폼 전체 오류를 만들지 않는다. 그것은 서버 도메인 예외의 몫이다.
 */
export function validate<T>(schema: ZodType<T>, values: unknown): ValidateResult<T> {
  const parsed = schema.safeParse(values)
  if (parsed.success) return { ok: true, data: parsed.data }

  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key !== 'string') continue
    if (fields[key] === undefined) fields[key] = issue.message
  }

  return { ok: false, errors: { fields, form: null } }
}
