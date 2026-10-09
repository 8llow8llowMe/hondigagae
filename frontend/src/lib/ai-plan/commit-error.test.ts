import { describe, expect, it } from 'vitest'

import { toAiPlanCommitErrors } from '@/lib/ai-plan/commit-error'
import { ApiError } from '@/lib/api/error'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * AI 초안 담기(`POST /plans`) 실패 → 폼 오류 (#1251).
 *
 * 담기 폼에는 `items` 칸이 없다. 공용 매핑(`apiErrorToFormErrors`)은 `PLAN_136` 을
 * `fields.items` 에 넣고 `form` 을 비우므로, 그대로 두면 **문구가 화면 어디에도 안 나온다.**
 */
const LIMIT_MESSAGE_136 = '일정 항목은 최대 100개까지 담을 수 있습니다.'

function limit136(extra: { code: string; field: string; message: string }[] = []) {
  const fieldErrors = [...extra, { code: 'PLAN_136', field: 'items', message: LIMIT_MESSAGE_136 }]
  return new ApiError(400, fieldErrors[0]?.code ?? null, fieldErrors[0]?.message, fieldErrors)
}

describe('toAiPlanCommitErrors', () => {
  it('전제 — 공용 매핑만 쓰면 PLAN_136 은 form 이 비어 보이지 않는다', () => {
    const errors = apiErrorToFormErrors(limit136(), messages.form.submitFailed)

    expect(errors.form).toBeNull()
    expect(errors.fields.items).toBe(LIMIT_MESSAGE_136)
  })

  it('PLAN_136 을 폼 전체 오류(상한 문구)로 올리고 items 칸 오류는 남기지 않는다', () => {
    const errors = toAiPlanCommitErrors(limit136())

    expect(errors.form).toBe(messages.aiPlan.commitItemLimitError)
    expect(errors.fields.items).toBeUndefined()
    expect(errors.form).not.toBe(messages.plan.saveStaleError)
  })

  it('함께 온 다른 필드 오류(title)는 그 칸에 그대로 둔다', () => {
    const errors = toAiPlanCommitErrors(
      limit136([{ code: 'PLAN_108', field: 'title', message: '제목은 필수입니다.' }]),
    )

    expect(errors.fields.title).toBe('제목은 필수입니다.')
    expect(errors.form).toBe(messages.aiPlan.commitItemLimitError)
  })

  it('계약 밖이지만 PLAN_028 이 와도 같은 상한 문구다', () => {
    const errors = toAiPlanCommitErrors(new ApiError(400, 'PLAN_028', '일정에는 …'))

    expect(errors.form).toBe(messages.aiPlan.commitItemLimitError)
  })

  it('다른 실패는 공용 매핑 그대로다 — PLAN_004 는 서버 문구가 form 에 간다', () => {
    const error = new ApiError(400, 'PLAN_004', '일정에 포함된 장소를 찾을 수 없습니다.')

    expect(toAiPlanCommitErrors(error)).toEqual(
      apiErrorToFormErrors(error, messages.form.submitFailed),
    )
  })

  it('ApiError 가 아닌 실패는 공용 기본 문구다', () => {
    expect(toAiPlanCommitErrors(new Error('boom'))).toEqual({
      fields: {},
      form: messages.form.submitFailed,
    })
  })
})
