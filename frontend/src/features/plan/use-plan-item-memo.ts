'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { invalidatePlanBriefing } from '@/features/plan/plan-briefing-invalidation'
import { planKeys } from '@/features/plan/queries'
import { markItemVisited, replaceDayItems } from '@/lib/api/plan'
import { type ItemMemoSaveInput, runItemMemoSave } from '@/lib/plan/item-memo-save'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

/** 되살리기 뒤 상세 재조회를 기다리는 상한 (ms). `use-plan-item-time.ts` 와 같은 값이다 */
const DETAIL_REFETCH_WAIT_MS = 1500

/**
 * 일정 상세에서 항목 하나의 메모를 고치거나 지운다 — 이슈 #1460 · `일정상세-세부명세.md` D30.
 *
 * **일자 일괄 교체다** (`PUT …/days/{day}/items`). 항목 단건 수정 API 는 `visited` · `startTime`
 * 뿐이다. 흐름(교체 → 갈아끼우기 → `다녀옴` 되살리기 → 재조회)과 갈래는 `runItemMemoSave` 가
 * 소유하고 테스트가 잠근다. 이 훅은 전송 · 캐시를 꽂고 진행 · 실패 상태만 든다.
 *
 * **`saving` 은 되살리기 · 재조회가 끝날 때까지 남는다** — 그동안 일자 저장 잠금(`dayItemsBusy`)이
 * 유지돼 순서 편집 · 담기가 새 `planItemId` 를 또 바꿔 되살리기를 `PLAN_005` 로 만들지 못한다.
 * 모달도 `onSaved` 까지 열려 있다(`PlanDetailSection` 의 `memoTarget` 스냅숏).
 *
 * **낙관적 업데이트를 하지 않는다** (`api-integration-guide.md` §7).
 */
export function usePlanItemMemo({
  planId,
  onSaved,
}: {
  planId: string
  /** 저장 성공(되살리기까지 끝난 뒤). 호출부가 모달을 닫는다 */
  onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [saving, setSaving] = useState(false)
  /** 실패도 **어느 항목에서** 났는지 든다 — 다른 항목의 모달을 열면 그 알림이 없어야 한다 */
  const [failure, setFailure] = useState<{ planItemId: string; error: PlanDaySaveError } | null>(
    null,
  )
  // disabled 반영 전 빠른 연속 제출을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  const save = useCallback(
    (input: ItemMemoSaveInput) => {
      if (savingRef.current) return
      savingRef.current = true
      setSaving(true)
      setFailure(null)

      void runItemMemoSave(input, {
        replace: (payload) => replaceDayItems(planId, input.day, payload),
        markVisited: (planItemId) => markItemVisited(planId, planItemId, true),
        onReplaced: (next) => {
          queryClient.setQueryData(planKeys.detail(planId), next)
          // 교체가 planItemId 를 전부 새로 발급한다 — 낡은 판정은 어느 행에도 안 붙는다 (D15-6)
          void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })
          // 판정이 메모를 읽지 않는다고 화면이 가려내면 서버 규칙을 복제한다 — 조회 한 번이다 (E3)
          void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
          void invalidatePlanBriefing(queryClient, planId)
        },
        /*
          재조회를 기다리되 **오래 기다리지 않는다** — 근거는 `use-plan-item-time.ts` 의
          `DETAIL_REFETCH_WAIT_MS` 주석(5xx 재시도 · 오프라인이면 모달을 닫을 길이 없어진다).
        */
        refetchDetail: () =>
          Promise.race([
            queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) }),
            new Promise<void>((resolve) => setTimeout(resolve, DETAIL_REFETCH_WAIT_MS)),
          ]),
      })
        .then((result) => {
          if (result.kind !== 'saved') {
            setFailure({ planItemId: input.planItemId, error: result.error })
            return
          }
          showToast({ message: result.toast })
          onSaved?.()
        })
        .finally(() => {
          savingRef.current = false
          setSaving(false)
        })
    },
    [planId, queryClient, showToast, onSaved],
  )

  /** 모달을 닫거나 다른 항목으로 열 때 지난 실패를 걷는다 */
  const clearFailure = useCallback(() => setFailure(null), [])

  return { save, saving, failure, clearFailure }
}
