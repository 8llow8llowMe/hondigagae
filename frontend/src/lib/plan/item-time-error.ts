import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 항목 시작 시각 단건 저장(`PUT /plans/{planId}/items/{planItemId}/start-time`) 실패의 분류 —
 * 이슈 #1053 · BE #1030.
 *
 * **`toPlanDaySaveError` 를 재사용하지 않는다** — `toVisitToggleError` 와 같은 판단이다. 그쪽은
 * 일괄 교체 전용이라 `PLAN_004`(사라진 장소) · `PLAN_002`(기간 밖 일자)를 갈라 보는데, 이 API 는
 * 그 일자의 장소를 되싣지 않아 둘 다 나올 수 없다. 대신 `PLAN_005`(이 일정의 항목이 아님)가 주된
 * 4xx 다. 없는 코드의 문구를 호출부가 떠안지 않게 한다.
 *
 * **반환 타입은 `PlanDaySaveError` 그대로다** — 화면이 할 일(`{message, retriable}`)이 같다.
 */
export function toItemStartTimeError(cause: unknown): PlanDaySaveError {
  if (cause instanceof ApiError) {
    /*
      `PLAN_100` — 본문 파싱 실패(`HttpMessageNotReadableException`). 이 API 의 본문은
      `startTime` 하나라 원인이 "시각 형식" 뿐이다. 전자시계가 `HH:mm:ss` 만 만들어 대개 닿지 않는다.
    */
    if (cause.resultCode === 'PLAN_100') {
      return { message: messages.plan.editStartTimeFormatError, retriable: false }
    }

    /*
      나머지 4xx — `PLAN_005`(없는 항목 · 다른 일정의 항목) · `PLAN_001`(없는 일정 · 남의 일정) ·
      `PLAN_124`(경로변수 형식). 모두 **들고 있는 상세가 낡았다**는 한 뜻이고 할 일이 새로고침으로
      같다. 특히 `PLAN_005` 는 다른 탭의 일괄 교체가 항목을 새로 발급한 뒤라 다시 눌러도 영영
      실패한다 — 재시도로 안내하지 않는다.
    */
    if (cause.kind !== 'temporary') {
      return { message: messages.plan.saveStaleError, retriable: false }
    }
  }

  // 일시 장애(5xx · 무응답 · `PLAN_900` 503)와 전송 단계 실패 — 같은 버튼으로 다시 보낸다
  return { message: messages.plan.itemTimeErrorDescription, retriable: true }
}
