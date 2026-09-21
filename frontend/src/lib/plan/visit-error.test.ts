import { describe, expect, it } from 'vitest'

import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { toVisitToggleError } from '@/lib/plan/visit-error'

/**
 * 방문 체크 실패 분류 — 이슈 #124.
 *
 * **재시도를 주는 것은 일시 장애뿐이다.** 나머지는 같은 요청을 다시 보내도 같은 실패고,
 * 특히 `PLAN_005`(없는 항목)는 **일괄 교체로 항목이 새로 발급된 뒤** 낡은 `planItemId`
 * 로 부른 경우라 다시 눌러도 영영 실패한다 — 새로고침해야 풀린다.
 */
describe('toVisitToggleError — 방문 체크 실패 분류 (#124)', () => {
  it('5xx 는 일시 장애다 — 재시도를 준다', () => {
    const error = toVisitToggleError(new ApiError(500, null, null))

    expect(error.retriable).toBe(true)
    expect(error.message).toBe(messages.plan.visitErrorDescription)
  })

  it('무응답도 일시 장애다', () => {
    expect(toVisitToggleError(new ApiError(NO_RESPONSE_STATUS, null, null)).retriable).toBe(true)
  })

  it('PLAN_900 503 도 일시 장애다 — 내부 연동 실패는 재시도로 풀린다', () => {
    expect(toVisitToggleError(new ApiError(503, 'PLAN_900', null)).retriable).toBe(true)
  })

  it('PLAN_005(없는 항목) 는 재시도를 주지 않는다 — 일괄 교체로 id 가 바뀐 경우다', () => {
    const error = toVisitToggleError(new ApiError(404, 'PLAN_005', null))

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.visitStaleError)
  })

  it('PLAN_001(없는 일정) 도 재시도를 주지 않는다', () => {
    expect(toVisitToggleError(new ApiError(404, 'PLAN_001', null)).retriable).toBe(false)
  })

  it('PLAN_124(경로 형식) 도 재시도를 주지 않는다', () => {
    expect(toVisitToggleError(new ApiError(400, 'PLAN_124', null)).retriable).toBe(false)
  })

  it('ApiError 가 아닌 실패는 전송 단계 실패로 보고 재시도를 준다', () => {
    expect(toVisitToggleError(new Error('boom')).retriable).toBe(true)
  })

  it('4xx 는 서버 문구를 그대로 노출하지 않는다 — 화면이 할 일을 말한다', () => {
    const error = toVisitToggleError(
      new ApiError(404, 'PLAN_005', '존재하지 않는 일정 항목입니다.'),
    )

    expect(error.message).not.toContain('존재하지 않는')
  })
})
