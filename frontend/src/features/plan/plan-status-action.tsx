'use client'

import { useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { PlanStatusActionPanel } from '@/features/plan/plan-status-action-panel'
import { planKeys } from '@/features/plan/queries'
import { updatePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import {
  type PlanStatusActionKind,
  planStatusActions,
  type PlanStatusActionSpec,
} from '@/lib/plan/status-action'
import type { PlanDetail } from '@/types/plan'

const ACTION_LABELS: Record<PlanStatusActionKind, string> = {
  confirm: messages.plan.statusConfirmAction,
  complete: messages.plan.statusCompleteAction,
  'revert-draft': messages.plan.statusRevertAction,
  reopen: messages.plan.statusReopenAction,
}

const ACTION_ERRORS: Record<PlanStatusActionKind, string> = {
  confirm: messages.plan.statusConfirmError,
  complete: messages.plan.statusCompleteError,
  'revert-draft': messages.plan.statusRevertError,
  reopen: messages.plan.statusReopenError,
}

/**
 * 일정 확정 · 완료 · 되돌리기 — 아트보드 01 + #613.
 *
 * **`{ status }` 하나만 보낸다.** `PUT` 은 부분 수정이라 보내지 않은 필드는 유지된다
 * (`PlanCommandProcessor.updatePlan`) — 제목·기간을 함께 실어 보내면 화면이 들고 있던
 * 낡은 값으로 덮어쓸 위험이 생긴다.
 *
 * 응답이 `PlanDetailResponse` 전체라 `setQueryData` 로 갈아끼우고 목록만 무효화한다 —
 * 상세를 다시 조회하지 않는다.
 *
 * ## 확인 대화상자를 붙이지 않는다 (#565 · #613)
 *
 * **되돌릴 수 있기 때문이다.** 백엔드에 상태 전이 가드가 없다.
 * 초안 ↔ 확정, 확정 ↔ 완료는 반대 버튼이 있다. 되돌릴 수 있는 동작에 확인을 붙이면
 * **되돌릴 수 없다는 거짓말**이 된다.
 *
 * 삭제는 반대다 — `담은 장소와 일자별 판정이 함께 사라져요. 되돌릴 수 없어요.` 로
 * `ConfirmModal` 을 세운다 (`plan-manage-menu.tsx`).
 *
 * ## 완료에서는 초안으로 되돌리지 않는다
 *
 * 다녀온 기록을 작성 중으로 되돌리는 것은 다른 판단이다. 잘못 닫았으면 확정으로만
 * 되돌린다. 초안에서는 완료를 열지 않는다.
 *
 * 어떤 버튼을 그릴지는 `planStatusActions` 한 곳이 정한다.
 */
export function PlanStatusAction({ plan }: { plan: PlanDetail }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const savingRef = useRef(false)
  const actions = planStatusActions(plan.status.code)

  function handleAction(action: PlanStatusActionSpec) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setErrorMessage(null)

    void updatePlan(plan.planId, { status: action.nextStatus })
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(plan.planId), next)
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
      })
      .catch((error: unknown) => {
        setErrorMessage(apiErrorToFormErrors(error, ACTION_ERRORS[action.kind]).form)
      })
      .finally(() => {
        savingRef.current = false
        setSaving(false)
      })
  }

  return (
    <PlanStatusActionPanel
      actions={actions}
      labels={ACTION_LABELS}
      errorMessage={errorMessage}
      saving={saving}
      onAction={handleAction}
    />
  )
}
