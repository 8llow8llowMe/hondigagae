import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 방문 체크(`PUT /plans/{planId}/items/{planItemId}/visited`) 실패의 분류 — 이슈 #124.
 *
 * **`toPlanDaySaveError` 를 재사용하지 않는다.** 그쪽은 일괄 교체 전용이라 `PLAN_004`
 * (사라진 장소)·`PLAN_002`(기간 밖 일자)를 갈라 보는데, 이 API 는 본문이 `{visited}`
 * 하나뿐이어서 그 둘이 나올 수 없다. 대신 그쪽에 없는 `PLAN_005`(없는 항목)가 여기의
 * 주된 4xx 다. 분류가 다른 것을 같은 함수에 밀어 넣으면 두 화면이 서로의 없는 코드를
 * 떠안는다.
 *
 * **반환 타입은 `PlanDaySaveError` 를 그대로 쓴다** — `{message, retriable}` 로 화면이
 * 할 일이 같고, 타입을 하나 더 만들면 재시도 유무를 다루는 규칙이 두 벌이 된다.
 */
export function toVisitToggleError(cause: unknown): PlanDaySaveError {
  /*
    **재시도를 주는 것은 일시 장애뿐이다.** `ApiError.kind === 'temporary'` 는 5xx ·
    무응답 · `PLAN_900` 503(내부 연동 실패)을 덮는다.

    나머지 4xx 는 코드별로 문구를 나누지 않는다 — `PLAN_005`(없는 항목) ·
    `PLAN_001`(없는 일정/남의 일정) · `PLAN_124`(경로변수 형식)가 모두 **들고 있는 상세가
    낡았다**는 한 가지 뜻이고, 사용자가 할 일이 "이 화면을 다시 여는 것" 으로 같다.

    특히 `PLAN_005` 는 **일괄 교체가 항목을 새로 발급한 뒤** 낡은 `planItemId` 로 부른
    경우라, 다시 눌러도 영영 실패한다. 여기에 재시도 버튼을 주면 안 된다.
  */
  if (cause instanceof ApiError && cause.kind !== 'temporary') {
    return { message: messages.plan.visitStaleError, retriable: false }
  }

  return { message: messages.plan.visitErrorDescription, retriable: true }
}
