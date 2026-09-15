import { PlanStatusActionPanel } from '@/features/plan/plan-status-action-panel'
import {
  forwardStatusAction,
  PLAN_STATUS_ACTION_LABELS,
  type PlanStatusActionSpec,
} from '@/lib/plan/status-action'

/**
 * 일정 확정 · 완료 — 아트보드 01 + #613.
 *
 * ## 정방향만 여기 선다 (#653 · 진단 PL-2)
 *
 * `확정하기` · `완료하기` 는 **그 상태에서 사용자가 할 다음 일**이라 개요 카드 아래 전폭
 * 버튼으로 남는다. `초안으로 되돌리기` · `확정으로 되돌리기` 는 `⋯` 메뉴로 내려갔다
 * (`plan-manage-menu.tsx`).
 *
 * **PL-2 가 "전부 메뉴로" 를 제안했지만 그렇게 하지 않았다.** 그 지적의 해악은 *"드물고
 * 되돌리기 어려운 상태 변경이 가장 강한 자리를 차지한다"* 인데 정방향은 둘 다 아니다.
 * 전부 내리면 `#553` 이 확정 버튼을 마지막 일자 끝에서 개요 아래로 끌어올린 결정까지
 * 되돌린다. 갈린 축은 `direction` 이고 정본은 `lib/plan/status-action.ts` 다.
 *
 * ## 확인 대화상자를 붙이지 않는다 (#565 · #613)
 *
 * **되돌릴 수 있기 때문이다.** 백엔드에 상태 전이 가드가 없다. 초안 ↔ 확정, 확정 ↔ 완료는
 * 반대 경로가 있다. 되돌릴 수 있는 동작에 확인을 붙이면 **되돌릴 수 없다는 거짓말**이 된다.
 *
 * 삭제는 반대다 — `ConfirmModal` 을 세운다 (`plan-manage-menu.tsx`).
 *
 * **mutation 을 직접 갖지 않는다.** 메뉴 안의 역방향과 같은 진행·실패를 봐야 해서
 * `usePlanStatus` 한 곳이 들고, 여기는 결과만 받는다 (명세 D11-2).
 */
export function PlanStatusAction({
  statusCode,
  saving,
  errorMessage,
  onAction,
}: {
  statusCode: string
  saving: boolean
  errorMessage: string | null
  onAction: (action: PlanStatusActionSpec) => void
}) {
  return (
    <PlanStatusActionPanel
      action={forwardStatusAction(statusCode)}
      labels={PLAN_STATUS_ACTION_LABELS}
      errorMessage={errorMessage}
      saving={saving}
      onAction={onAction}
    />
  )
}
