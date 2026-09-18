import { ApiError } from '@/lib/api/error'
import { toMessage } from '@/lib/api/response'
import { messages } from '@/lib/messages'

/**
 * 복사 실패 뒤 화면이 안내할 다음 행동. `FormAlert` 아래 붙는 링크 목적지다 (D5).
 *
 * - `'none'` — 링크 없음(같은 버튼으로 다시 제출 가능하거나, 아예 제출을 막는다)
 * - `'pets'` — `/pets` (`PLAN_010`, `copyPetAction`)
 * - `'list'` — `/plans` (`PLAN_001`, `copyMissingPlanAction`). **제출도 비활성으로 둔다**
 */
export type PlanCopyErrorNext = 'none' | 'pets' | 'list'

export type PlanCopyError = {
  message: string
  retriable: boolean
  next: PlanCopyErrorNext
}

/**
 * `POST /plans/{planId}/copy` 실패 분류 (`일정복사-세부명세.md` D3-2 · D5).
 *
 * **`visit-error.ts`·`save-error.ts` 와 반대 방향이다.** 저쪽들은 서버 문구를 화면
 * 문구로 대체하는데, 이 API 의 4xx(`PLAN_021`·`PLAN_010`·PLAN_105/106 등)는 **화면이
 * 문장을 짓지 않고 서버 `resultMessage` 를 그대로** 띄운다 — 특히 `PLAN_021` 은 원본과
 * 일수가 다르다는 사실을 서버만 알고 있어 화면이 대신 지으면 틀린 진단이 나갈 수 있다.
 *
 * 대체하는 것은 **일시 장애(5xx·무응답)와 빈 `resultMessage`** 뿐이다 — 둘 다 화면이
 * 보여줄 서버 문장이 없거나 신뢰할 수 없는 경우다.
 */
export function toPlanCopyError(cause: unknown): PlanCopyError {
  if (!(cause instanceof ApiError) || cause.kind === 'temporary') {
    return { message: messages.plan.copyError, retriable: true, next: 'none' }
  }

  if (cause.status === 404) {
    return {
      message: toMessage(cause.rawMessage, messages.plan.copyError),
      retriable: false,
      next: 'list',
    }
  }

  if (cause.resultCode === 'PLAN_010') {
    return {
      message: toMessage(cause.rawMessage, messages.plan.copyError),
      retriable: false,
      next: 'pets',
    }
  }

  // PLAN_021(일수 불일치) · PLAN_105/106(필수값) 등 그 밖의 4xx — 서버 문구 그대로
  return {
    message: toMessage(cause.rawMessage, messages.plan.copyError),
    retriable: false,
    next: 'none',
  }
}
