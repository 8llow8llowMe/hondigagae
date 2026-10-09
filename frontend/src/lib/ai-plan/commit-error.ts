import { apiErrorToFormErrors, type FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { isPlanItemLimitError } from '@/lib/plan/item-limit'

/** 상한 오류가 실리는 요청 필드. 담기 폼에는 이 칸이 없다 */
const ITEMS_FIELD = 'items'

/**
 * AI 초안 담기(`POST /plans`) 실패를 폼 오류로 옮긴다 (#1251).
 *
 * **항목 수 상한(`PLAN_136`)만 공용 매핑과 다르게 다룬다.** 그 오류는 `fieldErrors` 에
 * `{ field: 'items' }` 로 와서 공용 `apiErrorToFormErrors` 가 `fields.items` 에 넣고
 * `form` 을 비운다 — 담기 폼에는 `items` 칸이 없어 **문구가 화면 어디에도 나오지 않는다.**
 * 그래서 이 코드는 폼 전체 오류로 올린다. 함께 온 다른 필드 오류(`title`)는 제자리에 둔다.
 *
 * 공용 규칙("폼에 없는 필드의 오류는 form 으로")으로 넓히지 않는다 — 폼마다 칸 목록을
 * 알려 줘야 해서 모든 `useForm` 호출부가 바뀌고, 상한 말고는 이 문제를 겪는 코드가 없다.
 *
 * **문구는 FE 것이다** (서버 `resultMessage` 를 쓰지 않는다). 서버 문구는 사실만 말하고 다음에
 * 할 일이 없는데, 이 화면에서는 초안의 항목을 줄일 수 없어 "다시 만들기" 가 유일한 길이다.
 * 근거는 plan 공통명세 에러 표.
 */
export function toAiPlanCommitErrors(error: unknown): FormErrors {
  const base = apiErrorToFormErrors(error, messages.form.submitFailed)
  if (!isPlanItemLimitError(error)) return base

  const fields = { ...base.fields }
  delete fields[ITEMS_FIELD]
  return { fields, form: messages.aiPlan.commitItemLimitError }
}
