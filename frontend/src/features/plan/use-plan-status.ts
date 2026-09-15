'use client'

import { useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { planKeys } from '@/features/plan/queries'
import { updatePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import type { PlanStatusActionKind, PlanStatusActionSpec } from '@/lib/plan/status-action'

export const PLAN_STATUS_ACTION_LABELS: Record<PlanStatusActionKind, string> = {
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
 * 일정 상태 전이 한 벌 — 요청 · 진행 · 실패.
 *
 * **훅으로 뽑은 이유는 진입점이 둘로 갈렸기 때문이다** (#653 · 명세 D11-2). 정방향은 개요
 * 아래 전폭 버튼이고 역방향은 `⋯` 메뉴 안인데, 두 컴포넌트가 각자 상태를 들면 **한쪽이
 * 저장 중인 것을 다른 쪽이 모른다** — 메뉴에서 `초안으로 되돌리기` 를 누른 동안 전폭
 * 버튼이 멀쩡히 눌린다. 상태를 한 곳에 두고 두 자리가 같은 것을 본다.
 *
 * **오류 자리는 메뉴 밖이다.** 메뉴는 선택과 동시에 닫히므로 그 안에 실패를 그릴 자리가
 * 없다 — 화면(개요 아래 액션 자리)이 말한다.
 *
 * **`{ status }` 하나만 보낸다.** `PUT` 은 부분 수정이라 제목·기간을 함께 실으면 화면이
 * 들고 있던 낡은 값으로 덮어쓸 위험이 생긴다 (`PlanCommandProcessor.updatePlan`).
 * 응답이 `PlanDetailResponse` 전체라 `setQueryData` 로 갈아끼우고 목록만 무효화한다.
 */
export function usePlanStatus(planId: string) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  function run(action: PlanStatusActionSpec) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setErrorMessage(null)

    void updatePlan(planId, { status: action.nextStatus })
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(planId), next)
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

  return { run, saving, errorMessage }
}
