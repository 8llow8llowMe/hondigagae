import { describe, expect, it } from 'vitest'

import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { toItemStartTimeError } from '@/lib/plan/item-time-error'

/**
 * 항목 시작 시각 단건 저장 실패 분류 — 이슈 #1053.
 *
 * **재시도를 주는 것은 일시 장애뿐이다.** `PLAN_005`(이 일정의 항목이 아님)는 다른 탭의 일괄
 * 교체가 항목을 새로 발급한 뒤 낡은 `planItemId` 로 부른 경우라 다시 눌러도 영영 실패한다.
 */
describe('toItemStartTimeError — 항목 시각 저장 실패 분류 (#1053)', () => {
  it('5xx 는 일시 장애다 — 재시도 문구를 낸다', () => {
    const error = toItemStartTimeError(new ApiError(500, null, null))

    expect(error.retriable).toBe(true)
    expect(error.message).toBe(messages.plan.itemTimeErrorDescription)
  })

  it('무응답 · PLAN_900 503 도 일시 장애다', () => {
    expect(toItemStartTimeError(new ApiError(NO_RESPONSE_STATUS, null, null)).retriable).toBe(true)
    expect(toItemStartTimeError(new ApiError(503, 'PLAN_900', null)).retriable).toBe(true)
  })

  it('PLAN_005(없는 항목) 404 는 재시도를 주지 않는다 — 들고 있는 상세가 낡았다', () => {
    const error = toItemStartTimeError(
      new ApiError(404, 'PLAN_005', '존재하지 않는 일정 항목입니다.'),
    )

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.saveStaleError)
  })

  it('PLAN_001(없는 일정 · 남의 일정) · PLAN_124(경로 형식) 도 재시도를 주지 않는다', () => {
    expect(toItemStartTimeError(new ApiError(404, 'PLAN_001', null)).retriable).toBe(false)
    expect(toItemStartTimeError(new ApiError(400, 'PLAN_124', null)).retriable).toBe(false)
  })

  it('PLAN_100(본문 파싱 실패) 은 시각 형식 문구다 — 재시도 없음', () => {
    const error = toItemStartTimeError(new ApiError(400, 'PLAN_100', null))

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.editStartTimeFormatError)
  })

  it('ApiError 가 아닌 실패는 전송 단계 실패로 보고 재시도를 준다', () => {
    expect(toItemStartTimeError(new Error('boom')).retriable).toBe(true)
  })
})
