import { describe, expect, it } from 'vitest'

import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { toPlanCopyError } from '@/lib/plan/copy-error'

/**
 * 일정 복사 실패 분류 (#617, `일정복사-세부명세.md` D3-2 · D5).
 *
 * **`visit-error.ts` 와 반대다.** 저쪽은 서버 문구를 화면 문구로 대체하지만, 여기는
 * "화면이 문장을 짓지 않는다" 는 명세 원칙에 따라 400/404 서버 `resultMessage` 를
 * **그대로** 노출한다. 대체하는 것은 일시 장애와 빈 문구뿐이다.
 */
describe('toPlanCopyError — 일정 복사 실패 분류 (#617)', () => {
  it('PLAN_021(일수 불일치)은 서버 문구 그대로 · retriable false · next none', () => {
    const error = toPlanCopyError(
      new ApiError(400, 'PLAN_021', '복사할 여행 기간의 일수는 원본과 같아야 합니다.'),
    )

    expect(error.message).toBe('복사할 여행 기간의 일수는 원본과 같아야 합니다.')
    expect(error.retriable).toBe(false)
    expect(error.next).toBe('none')
  })

  it('PLAN_010(반려견 없음)은 서버 문구 그대로 · next pets', () => {
    const error = toPlanCopyError(
      new ApiError(400, 'PLAN_010', '동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.'),
    )

    expect(error.message).toBe('동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.')
    expect(error.next).toBe('pets')
    expect(error.retriable).toBe(false)
  })

  it('PLAN_001(404)은 서버 문구 그대로 · retriable false · next list', () => {
    const error = toPlanCopyError(new ApiError(404, 'PLAN_001', '존재하지 않는 여행 일정입니다.'))

    expect(error.message).toBe('존재하지 않는 여행 일정입니다.')
    expect(error.retriable).toBe(false)
    expect(error.next).toBe('list')
  })

  it('503 은 일시 장애 — copyError · retriable true', () => {
    const error = toPlanCopyError(new ApiError(503, null, '내부 오류'))

    expect(error.message).toBe(messages.plan.copyError)
    expect(error.retriable).toBe(true)
    expect(error.next).toBe('none')
  })

  it('무응답도 일시 장애다', () => {
    const error = toPlanCopyError(new ApiError(NO_RESPONSE_STATUS, null, null))

    expect(error.retriable).toBe(true)
    expect(error.message).toBe(messages.plan.copyError)
  })

  it('ApiError 가 아닌 실패는 전송 단계 실패로 보고 재시도를 준다', () => {
    const error = toPlanCopyError(new Error('boom'))

    expect(error.retriable).toBe(true)
    expect(error.message).toBe(messages.plan.copyError)
  })

  it('resultMessage 가 빈 문자열인 400 은 copyError 로 대체한다 — 빈 배너를 띄우지 않는다', () => {
    const error = toPlanCopyError(new ApiError(400, 'PLAN_021', ''))

    expect(error.message).toBe(messages.plan.copyError)
  })

  it('그 밖의 400 은 서버 문구를 그대로 쓴다', () => {
    const error = toPlanCopyError(new ApiError(400, 'PLAN_105', '여행 시작일은 필수입니다.'))

    expect(error.message).toBe('여행 시작일은 필수입니다.')
    expect(error.next).toBe('none')
  })
})
