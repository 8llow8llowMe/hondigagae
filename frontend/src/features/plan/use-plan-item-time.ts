'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { planKeys } from '@/features/plan/queries'
import { replaceDayItems } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import { setItemStartTimePayload } from '@/lib/plan/day-items'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 일정 목록에서 항목 하나의 시작 시각을 저장한다 — 이슈 #1028 · `일자편집-세부명세.md` G3.
 *
 * **`usePlanAddMove` 와 저장 후처리가 같다.** 같은 `PUT …/days/{day}/items` 일괄 교체라
 * 응답으로 상세를 갈아끼우고 판정 · 산책 위험도를 버린다 (E3 · D15-6). 산책 위험도는
 * 특히 이 저장의 직접 입력이다 — `startTime` 이 바뀌면 그 항목의 판정 시각이 바뀐다.
 *
 * **낙관적 업데이트를 하지 않는다.** `planItemId` 를 서버가 새로 발급하고 `PLAN_004` 처럼
 * 재시도로 풀리지 않는 실패가 있다 (`use-plan-add-place.ts` 와 같은 판단).
 */
export function usePlanItemTime({
  planId,
  onSaved,
}: {
  planId: string
  /** 저장 성공. 호출부가 모달을 닫는다 */
  onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [saving, setSaving] = useState(false)
  /** 실패도 **어느 항목에서** 났는지 든다 — 다른 항목의 모달을 열면 그 알림이 없어야 한다 */
  const [failure, setFailure] = useState<{ planItemId: string; error: PlanDaySaveError } | null>(
    null,
  )
  // disabled 반영 전 빠른 연속 제출(Enter 두 번)을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  const save = useCallback(
    ({
      day,
      dayItems,
      planItemId,
      startTime,
    }: {
      day: number
      /** 그 일자의 **현재 항목 전부**. 되싣지 않으면 일자가 비워진다 */
      dayItems: PlanItemDetail[]
      planItemId: string
      /** `HH:mm:ss`. `null` 이면 지운다 */
      startTime: string | null
    }) => {
      if (savingRef.current) return

      const payload = setItemStartTimePayload(dayItems, day, planItemId, startTime)
      const target = dayItems.find((item) => item.planItemId === planItemId)
      /*
        **들고 있는 상세에 그 항목이 없다** — 다른 탭에서 일정이 바뀌어 낡은 상세로 누른
        것이다. 지어낸 목록을 보내지 않고 새로고침을 안내한다 (`PLAN_002` 와 같은 결).
      */
      if (payload === null || target === undefined) {
        setFailure({
          planItemId,
          error: { message: messages.plan.saveStaleError, retriable: false },
        })
        return
      }

      savingRef.current = true
      setSaving(true)
      setFailure(null)

      /*
        **`.then(onSuccess, onError)` 2인자 형태다** (`use-plan-add-move.ts` 와 같다).
        `.then().catch()` 면 성공 후처리에서 던진 예외가 저장 실패로 분류돼 **저장은 됐는데
        "저장하지 못했어요" 가 뜬다.**
      */
      void replaceDayItems(planId, day, payload)
        .then(
          (next) => {
            queryClient.setQueryData(planKeys.detail(planId), next)
            // 판정은 항목 배열로 계산된다 — 이 교체가 판정과 무관한지 화면이 가려내지 않는다 (E3)
            void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
            // 교체가 planItemId 를 전부 새로 발급하고, 바뀐 시각이 곧 판정 입력이다 (D15-6)
            void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })

            showToast({
              message: (startTime === null
                ? messages.plan.itemTimeClearedToast
                : messages.plan.itemTimeSavedToast
              ).replace('{title}', target.title),
            })
            onSaved?.()
          },
          (cause: unknown) =>
            setFailure({
              planItemId,
              error: toPlanDaySaveError(cause, {
                retriable: messages.plan.itemTimeErrorDescription,
                missingPlace: messages.plan.itemTimeMissingPlaceError,
              }),
            }),
        )
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
