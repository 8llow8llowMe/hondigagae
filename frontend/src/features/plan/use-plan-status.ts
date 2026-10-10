'use client'

import { useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { invalidatePlanBriefing } from '@/features/plan/plan-briefing-invalidation'
import { planKeys } from '@/features/plan/queries'
import { updatePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import {
  changesPetConditionSource,
  type PlanStatusActionKind,
  type PlanStatusActionSpec,
  type PlanStatusFailure,
  type PlanStatusResult,
  planStatusResultAnnounce,
} from '@/lib/plan/status-action'

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
 * 응답이 `PlanDetailResponse` 전체라 `setQueryData` 로 갈아끼우고 목록 · 브리핑을 무효화한다
 * (완료 ↔ 진행 전환은 판정 · 산책 위험도까지 — 아래).
 *
 * **성공도 화면이 말한다** (#1174). `result` 는 마지막으로 성공한 전이다 — 개요 아래 액션 자리가
 * 결과 한 줄(확정이면 `공유 링크` 까지)을 그린다. 다음 전이를 시작하면 걷는다: 진행 중에 직전
 * 결과가 남아 있으면 "확정했어요" 아래에서 되돌리기가 돌고, 실패하면 성공과 실패가 나란히 선다.
 *
 * **실패도 읽히는 길을 함께 든다** (#1203). `failure` 는 문구와 `announce` 한 쌍이다 — 성공과 같은
 * 판정(`planStatusResultAnnounce`)으로, 전폭 버튼에서 왔으면 알림으로 포커스를 옮기고 메뉴에서
 * 왔으면 `⋯` 에 둔 채 `role="alert"` 다. 패널의 포커스 effect 가 이 객체의 동일성에 걸려 있어
 * 같은 실패를 다시 겪어도(재시도 실패) 새 객체라 포커스가 다시 온다.
 */
export function usePlanStatus(planId: string) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<PlanStatusFailure | null>(null)
  const [result, setResult] = useState<PlanStatusResult | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  function run(action: PlanStatusActionSpec) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setFailure(null)
    setResult(null)

    void updatePlan(planId, { status: action.nextStatus })
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(planId), next)
        /*
          **응답이 온 지금의 포커스로 읽힐 길을 정한다** — 전폭 버튼에서 왔으면 이미 `BODY` 라
          안내로 옮기고, 메뉴에서 왔으면 `⋯` 에 둔 채 낭독한다 (`planStatusResultAnnounce`).
        */
        setResult({
          kind: action.kind,
          announce: planStatusResultAnnounce(document.activeElement, document.body),
        })
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
        /*
          **브리핑은 버린다** (#1055). 서버가 반려견 특성을 상태에 따라 읽는다 — 완료 일정은
          완료 시점 스냅샷, 진행 중은 지금 프로필이다(`PlanWeatherProcessor.loadConditions`, #629).
          완료를 되돌리면 브리핑의 기준이 바뀐다.
        */
        void invalidatePlanBriefing(queryClient, planId)
        /*
          **판정 · 산책 위험도는 완료로 들어가거나 나올 때만 버린다** (#1058). 둘도 같은 특성을
          읽지만(`PlanWalkSafetyProcessor` 도 `loadConditions` 를 쓴다), 브리핑과 달리 상세 화면이
          지금 관찰 중이라 버리면 곧바로 다시 받는다 — 장소마다 원격 호출이다. 초안 ↔ 확정은
          특성의 출처가 그대로라 받을 이유가 없다 (`changesPetConditionSource`).
        */
        if (changesPetConditionSource(action.kind)) {
          void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
          void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })
        }
      })
      .catch((error: unknown) => {
        const fallback = ACTION_ERRORS[action.kind]
        // 필드 오류로 온 400 은 `form` 이 비지만 이 화면엔 그릴 필드가 없다 — 무음 실패 대신 기본 문구
        const message = apiErrorToFormErrors(error, fallback).form ?? fallback
        // 성공과 같은 시점 · 같은 판정이다 — 버튼이 살아나기(`finally`) 전의 포커스를 본다
        setFailure({
          message,
          announce: planStatusResultAnnounce(document.activeElement, document.body),
        })
      })
      .finally(() => {
        savingRef.current = false
        setSaving(false)
      })
  }

  return { run, saving, failure, result }
}
