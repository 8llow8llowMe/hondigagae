import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { toPlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 일괄 교체 저장 실패 분류 — 편집모드(#81)와 담기(#82)가 **같은 함수를 쓴다.**
 * 두 벌이 되면 한쪽만 고쳐졌을 때 같은 400 에 다른 안내가 나간다.
 */
const COPY = {
  retriable: messages.plan.addPlaceErrorDescription,
  missingPlace: messages.plan.addPlaceMissingPlaceError,
}

describe('toPlanDaySaveError', () => {
  it('PLAN_004 는 재시도를 주지 않는다 — 같은 본문이 같은 400 을 받는다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_004', null), COPY)

    expect(error.retriable).toBe(false)
    // 문구는 화면이 준다 — 담기 화면에는 "빼낼 목록" 이 없어 편집모드 문구를 쓸 수 없다
    expect(error.message).toBe(COPY.missingPlace)
    expect(error.message).not.toBe(messages.plan.editMissingPlaceError)
  })

  it('PLAN_002 는 재시도가 아니라 새로고침이다 — 들고 있는 상세가 낡았다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_002', null), COPY)

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.editDayOutOfRangeError)
  })

  it('5xx 는 재시도 가능하고 문구는 호출부가 준다 — 담기에는 "편집한 내용" 이 없다', () => {
    const error = toPlanDaySaveError(new ApiError(500, null, null), COPY)

    expect(error.retriable).toBe(true)
    expect(error.message).toBe(COPY.retriable)
    expect(error.message).not.toBe(messages.plan.editSaveErrorDescription)
  })

  it('ApiError 가 아닌 실패도 재시도 가능으로 다룬다', () => {
    expect(toPlanDaySaveError(new Error('boom'), COPY).retriable).toBe(true)
  })

  /*
    회귀 방지 — 되풀이해도 안 되는 4xx 에 `다시 시도` 를 주면 안 된다.
    근거: PlanErrorCode.java · ValidationErrorSupport.java 소스 실측.
  */
  it('PLAN_001(404, 지워졌거나 남의 일정)에 재시도를 주지 않는다', () => {
    const error = toPlanDaySaveError(new ApiError(404, 'PLAN_001', null), COPY)

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.saveStaleError)
  })

  it('Bean Validation(PLAN_110 등)에도 재시도를 주지 않는다', () => {
    expect(toPlanDaySaveError(new ApiError(400, 'PLAN_110', null), COPY).retriable).toBe(false)
  })

  /* PLAN_100 — 시각 본문 파싱 실패 (#623 · 명세 G4). 화면마다 문구를 나누지 않는다 */
  it('PLAN_100(시각 형식 오류)은 전용 문구를 내고 재시도를 주지 않는다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_100', null), COPY)

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.editStartTimeFormatError)
  })

  it('PLAN_900(503, tour-service 연동 실패)은 일시 장애라 재시도한다', () => {
    const error = toPlanDaySaveError(new ApiError(503, 'PLAN_900', null), COPY)

    expect(error.retriable).toBe(true)
    expect(error.message).toBe(COPY.retriable)
  })

  it('PLAN_002 는 문구를 나누지 않는다 — 어느 화면에서든 할 일이 새로고침으로 같다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_002', null), COPY)

    expect(error.message).toBe(messages.plan.editDayOutOfRangeError)
  })
  /*
    일정 항목 수 상한 (#1251 · BE #1243). 새로고침해도 같은 400 이 되풀이된다 — 예전에는
    "나머지 4xx" 로 떨어져 `saveStaleError`("새로고침한 뒤 다시 시도")를 보였다.
  */
  it.each([
    ['PLAN_028', null],
    [
      'PLAN_136',
      [
        {
          code: 'PLAN_136',
          field: 'items',
          message: '일정 항목은 최대 100개까지 담을 수 있습니다.',
        },
      ],
    ],
  ] as const)('%s 는 상한 문구를 내고 재시도를 주지 않는다', (code, fieldErrors) => {
    const error = toPlanDaySaveError(
      new ApiError(400, code, null, fieldErrors === null ? null : [...fieldErrors]),
      COPY,
    )

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.saveItemLimitError)
    expect(error.message).not.toBe(messages.plan.saveStaleError)
    expect(error.message).toContain('100')
  })

  it('상한 문구는 화면 문구(copy)와 무관하게 같다 — 편집모드에도 같은 문구다', () => {
    const edit = toPlanDaySaveError(new ApiError(400, 'PLAN_028', null), {
      retriable: messages.plan.editSaveErrorDescription,
      missingPlace: messages.plan.editMissingPlaceError,
    })

    expect(edit.message).toBe(messages.plan.saveItemLimitError)
  })

  it('상한이 아닌 나머지 4xx(PLAN_124)는 여전히 새로고침 안내다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_124', null), COPY)

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.saveStaleError)
  })
})
