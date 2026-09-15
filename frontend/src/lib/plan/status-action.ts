import type { PlanStatusCode } from '@/types/plan'

/**
 * 일정 상태 버튼. 서버는 `PUT /plans/{planId}` 의 `status` 만 받는다.
 *
 * **초안에서는 완료를 열지 않는다.** 확정하지 않은 여행을 마친 것으로 말하지 않는다.
 * **완료에서는 초안으로 되돌리지 않는다.** 다녀온 기록을 작성 중으로 되돌리는 것은
 * 다른 판단이다. 잘못 닫았으면 확정으로만 되돌린다.
 */
export type PlanStatusActionKind = 'confirm' | 'complete' | 'revert-draft' | 'reopen'

export type PlanStatusActionSpec = {
  kind: PlanStatusActionKind
  nextStatus: PlanStatusCode
  variant: 'primary' | 'secondary'
}

export function planStatusActions(statusCode: string): PlanStatusActionSpec[] {
  if (statusCode === 'DRAFT') {
    return [{ kind: 'confirm', nextStatus: 'CONFIRMED', variant: 'primary' }]
  }
  if (statusCode === 'CONFIRMED') {
    return [
      { kind: 'complete', nextStatus: 'COMPLETED', variant: 'primary' },
      { kind: 'revert-draft', nextStatus: 'DRAFT', variant: 'secondary' },
    ]
  }
  if (statusCode === 'COMPLETED') {
    return [{ kind: 'reopen', nextStatus: 'CONFIRMED', variant: 'secondary' }]
  }
  return []
}
