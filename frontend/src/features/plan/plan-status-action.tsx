'use client'

import { useState } from 'react'

import { PlanShareModal } from '@/features/plan/plan-share-modal'
import { PlanStatusActionPanel } from '@/features/plan/plan-status-action-panel'
import {
  PLAN_STATUS_ACTION_LABELS,
  PLAN_STATUS_ACTION_NOTES,
  PLAN_STATUS_RESULT_MESSAGES,
  type PlanStatusActionSpec,
  type PlanStatusResult,
  statusResultMatches,
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
 * ## 축이 하나 늘었다 — 시점 (#732)
 *
 * **출발 전(`upcoming`)에는 `여행 완료하기` 가 버튼이 아니다.** 시작일 전(D-1 이전)에는
 * 서버가 `PLAN_026` 으로 거절하므로 어디에도 없고(#971), 출발 당일에는 메뉴로 내려간다
 * (#732 — 390 실측에서 D-1 화면의 **유일한 filled 버튼**이 바로 그것이었다).
 * `확정하기` 는 그대로 남는다 — 전날의 초안은 확정할 수 있다.
 * 판정은 `planStatusActionLayout()` 하나가 하고, **이 컴포넌트는 결과만 받는다.**
 *
 * ## 확인 대화상자를 붙이지 않는다 (#565 · #613)
 *
 * **되돌릴 수 있기 때문이다.** 초안 ↔ 확정, 확정 ↔ 완료는 반대 경로가 있다. 백엔드의 전이
 * 가드는 시작일 전 완료(`PLAN_026`, #971) 하나뿐이고 되돌리기는 막지 않는다. 되돌릴 수
 * 있는 동작에 확인을 붙이면 **되돌릴 수 없다는 거짓말**이 된다.
 *
 * 삭제는 반대다 — `ConfirmModal` 을 세운다 (`plan-manage-menu.tsx`).
 *
 * **mutation 을 직접 갖지 않는다.** 메뉴 안의 역방향과 같은 진행·실패를 봐야 해서
 * `usePlanStatus` 한 곳이 들고, 여기는 결과만 받는다 (명세 D11-2).
 *
 * ## 확정 뒤 `공유 링크` 가 여기서 열린다 (#1174)
 *
 * 확정의 이유가 공유인데 그 문은 `⋯` 메뉴 안에만 있었다. 결과 안내 아래 버튼이 **같은
 * `PlanShareModal`** 을 연다 — 메뉴의 것과 조회 키가 같아 발급 상태를 두 곳이 같이 본다.
 * 모달 상태는 여기서 든다: 메뉴와 나누려고 위로 올리면 메뉴의 진입점까지 이 화면 구조에 묶인다.
 */
export function PlanStatusAction({
  planId,
  statusCode,
  action,
  saving,
  errorMessage,
  result,
  onAction,
}: {
  planId: string
  /** 지금 상태 — 결과가 이 상태로 온 전이일 때만 그린다 (`statusResultMatches`) */
  statusCode: string
  /**
   * 버튼으로 설 액션. **호출부가 `planStatusActionLayout()` 으로 정해 넘긴다** (#732) —
   * 상태 코드에서 다시 셈하면 메뉴 쪽과 판정이 갈린다. `undefined` 면 버튼이 없다.
   */
  action: PlanStatusActionSpec | undefined
  saving: boolean
  errorMessage: string | null
  /** `usePlanStatus().result` 그대로 — 패널의 포커스 effect 가 이 값의 동일성에 걸려 있다 */
  result: PlanStatusResult | null
  onAction: (action: PlanStatusActionSpec) => void
}) {
  const [shareOpen, setShareOpen] = useState(false)
  // 맞으면 같은 객체를 넘긴다 — 패널의 포커스 effect 가 동일성에 걸려 있다
  const shownResult =
    result !== null && statusResultMatches(result.kind, statusCode) ? result : null

  return (
    <>
      <PlanStatusActionPanel
        action={action}
        labels={PLAN_STATUS_ACTION_LABELS}
        notes={PLAN_STATUS_ACTION_NOTES}
        errorMessage={errorMessage}
        result={shownResult}
        resultMessages={PLAN_STATUS_RESULT_MESSAGES}
        onShare={() => setShareOpen(true)}
        saving={saving}
        onAction={onAction}
      />
      <PlanShareModal planId={planId} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  )
}
