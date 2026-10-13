'use client'

import { useEffect, useState } from 'react'

import { PlanConfirmCheckModal } from '@/features/plan/plan-confirm-check-modal'
import { planDayAnchorId } from '@/features/plan/plan-day-section'
import { PlanShareModal } from '@/features/plan/plan-share-modal'
import { PlanStatusActionPanel } from '@/features/plan/plan-status-action-panel'
import type { PlanConfirmCheckDay } from '@/lib/plan/confirm-check'
import {
  PLAN_STATUS_ACTION_LABELS,
  PLAN_STATUS_ACTION_NOTES,
  PLAN_STATUS_RESULT_MESSAGES,
  type PlanStatusActionSpec,
  type PlanStatusFailure,
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
 *
 * ## 확정 전에 점검한다 (#1425 · 명세 D26)
 *
 * `확정하기` 를 누르면 `confirmCheck` 가 비지 않을 때만 점검 시트를 먼저 연다. 비면 지금처럼
 * 바로 확정한다 — 시트는 확인 대화상자가 아니다(위 #565 판단 그대로). **버튼 자리는 옮기지
 * 않았다** — 검토 없이 누르는 문제는 자리가 아니라 이 시트가 받는다 (D26-3).
 */
export function PlanStatusAction({
  planId,
  statusCode,
  action,
  saving,
  failure,
  result,
  confirmCheck,
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
  /** `usePlanStatus().failure` 그대로 — 패널의 포커스 effect 가 이 값의 동일성에 걸려 있다 (#1203) */
  failure: PlanStatusFailure | null
  /** `usePlanStatus().result` 그대로 — 패널의 포커스 effect 가 이 값의 동일성에 걸려 있다 */
  result: PlanStatusResult | null
  /**
   * 확정 전 점검 결과 — `planConfirmCheck(days)` (D26-1). 비면 `확정하기` 가 바로 확정한다.
   * **지금의 결과**를 받는다: 상세가 다시 조회돼 문제가 사라지면 시트도 그만큼 줄고, 다 사라지면 닫힌다.
   */
  confirmCheck: readonly PlanConfirmCheckDay[]
  onAction: (action: PlanStatusActionSpec) => void
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [fixDay, setFixDay] = useState<number | null>(null)

  // 그사이 상태가 바뀌어 버튼이 `확정하기` 가 아니면 시트를 세우지 않는다 — `그대로 확정` 이 다른 전이를 부르지 않게
  const checkAvailable = confirmCheck.length > 0 && action?.kind === 'confirm'
  /*
    **시트를 세울 근거가 사라지면 열림도 내린다** (#1478). 상세가 다시 조회돼 문제가 다 사라지면 시트가
    닫혀 보이는데, 열림만 남아 있으면 나중에 새 문제가 생기는 순간 **누르지 않았는데** 시트가 다시
    선다. 렌더 중에 맞춘다 — effect 로 내리면 한 커밋 동안 열린 채 그려진다.
  */
  if (checkOpen && !checkAvailable) setCheckOpen(false)

  /*
    **일자로의 이동은 시트가 닫힌 뒤다** (D26-2). 시트가 닫힐 때 `useOverlay` 가 포커스를 확정
    버튼으로 되돌리며 그 자리로 화면을 굴린다 — 같은 클릭 안에서 먼저 굴리면 그 복귀가 되감는다.
    React 는 한 커밋에서 모든 effect cleanup(시트의 포커스 복귀)을 setup 보다 먼저 돌리므로 이
    effect 가 늘 뒤다.
  */
  useEffect(() => {
    if (fixDay === null) return
    focusPlanDay(fixDay)
    setFixDay(null)
  }, [fixDay])
  // 맞으면 같은 객체를 넘긴다 — 패널의 포커스 effect 가 동일성에 걸려 있다
  const shownResult =
    result !== null && statusResultMatches(result.kind, statusCode) ? result : null

  return (
    <>
      <PlanStatusActionPanel
        action={action}
        labels={PLAN_STATUS_ACTION_LABELS}
        notes={PLAN_STATUS_ACTION_NOTES}
        failure={failure}
        result={shownResult}
        resultMessages={PLAN_STATUS_RESULT_MESSAGES}
        onShare={() => setShareOpen(true)}
        saving={saving}
        onAction={(next) => {
          // 점검은 `확정하기` 에만 건다 — 완료 · 되돌리기는 일정 내용을 바꾸지 않는다 (D26-2)
          if (next.kind === 'confirm' && confirmCheck.length > 0) {
            setCheckOpen(true)
            return
          }
          onAction(next)
        }}
      />
      <PlanConfirmCheckModal
        open={checkOpen && checkAvailable}
        days={confirmCheck}
        onClose={() => setCheckOpen(false)}
        onFix={(day) => {
          setCheckOpen(false)
          setFixDay(day)
        }}
        onProceed={() => {
          setCheckOpen(false)
          if (action?.kind === 'confirm') onAction(action)
        }}
      />
      <PlanShareModal planId={planId} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  )
}

/**
 * 그 일자 제목으로 굴리고 포커스를 옮긴다 (D26-2 `고치러 가기`).
 *
 * 제목(`h2`)은 원래 포커스를 받지 않는다 — `tabindex="-1"` 을 붙여 프로그램으로만 받게 한다.
 * 포커스를 옮기지 않으면 키보드 사용자의 다음 Tab 이 확정 버튼 뒤에서 이어진다. 굴림은
 * `scrollIntoView` 가 하고(제목의 `scroll-mt-28` 이 고정 헤더 몫을 낸다) 포커스는 `preventScroll`
 * 로 준다 — 둘이 다른 위치로 굴리지 않게 한다.
 */
function focusPlanDay(day: number): void {
  const heading = document.getElementById(planDayAnchorId(day))
  if (heading === null) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.scrollIntoView({ block: 'start' })
  heading.focus({ preventScroll: true })
}
