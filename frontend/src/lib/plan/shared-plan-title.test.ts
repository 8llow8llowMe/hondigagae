import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { sharedPlanPageTitle } from '@/lib/plan/shared-plan-title'

/**
 * **#980.** `/shared-plans/{무효한 토큰}` 은 404 인데 탭이 `공유된 여행 일정` 이었다 — 본문
 * `h1` 은 `유효하지 않은 링크예요` 다. 메타데이터가 정적이라 조회 결과를 볼 수 없었다.
 *
 * **유효한 링크의 제목에는 일정 내용을 싣지 않는다** (`일정공유-세부명세.md` 보안 메모). 이 함수가
 * **오류만 받고 일정을 받지 않는 것**이 그 약속의 모양이다 — 넘길 자리가 없으니 실을 수 없다.
 */
describe('sharedPlanPageTitle', () => {
  it('조회 성공은 고정 제목이다 — 일정 이름이 아니다', () => {
    expect(sharedPlanPageTitle(null)).toBe(messages.plan.sharedPageTitle)
  })

  it('404(없는 토큰·폐기·삭제·초안 회귀)는 본문과 같은 "유효하지 않은 링크" 다', () => {
    const title = sharedPlanPageTitle(
      new ApiError(404, 'PLAN_023', '공유 링크가 유효하지 않습니다.'),
    )

    expect(title).toBe(messages.plan.sharedNotFoundTitle)
  })

  /*
    **410 도 본문과 같은 말을 한다.** 만료는 상태가 200 으로 남는 갈래라(`일정공유-세부명세.md`
    D8-2) 탭 제목이 상태를 말하는 유일한 신호다. 404 와 **다른 말**이어야 한다 — 받은 사람이
    할 수 있는 일(새 링크 요청)이 있는 갈래는 410 뿐이다.
  */
  it('410(만료)은 본문과 같은 "만료된 링크" 다 — 404 와 갈린다', () => {
    const title = sharedPlanPageTitle(new ApiError(410, 'PLAN_024', null))

    expect(title).toBe(messages.plan.sharedExpiredTitle)
    expect(title).not.toBe(messages.plan.sharedNotFoundTitle)
  })

  /*
    **5xx·무응답에는 단정하지 않는다** (`architecture-guide.md` §7 #206). `error.tsx` 의 재시도가
    성공하면 멀쩡한 일정 화면의 탭에 "유효하지 않은 링크" 가 남는다.
  */
  it('5xx·무응답·그 밖 4xx·ApiError 아님은 고정 제목으로 떨어진다', () => {
    for (const error of [
      new ApiError(503, null, null),
      new ApiError(0, null, null),
      new ApiError(400, 'PLAN_101', null),
      new TypeError('boom'),
    ]) {
      expect(sharedPlanPageTitle(error)).toBe(messages.plan.sharedPageTitle)
    }
  })
})
