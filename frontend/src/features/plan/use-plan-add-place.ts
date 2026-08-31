'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { planKeys } from '@/features/plan/queries'
import { replaceDayItems } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import { appendPlaceItemPayload } from '@/lib/plan/day-items'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
import { withObjectParticle } from '@/lib/text/korean'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 일자에 장소 하나를 담는다 — 실내 대안 `담기` 와 장소 추가 화면이 **같은 훅을 쓴다**.
 *
 * **새 API 가 없다.** 일자 편집과 같은 `PUT …/days/{day}/items` 일괄 교체라 기존 항목을
 * 되싣고 끝에 하나를 붙인다 (F0). 그래서 저장 후처리도 편집과 같아야 한다 —
 * 응답으로 상세를 갈아끼우고 판정을 무효화한다 (E3).
 *
 * **낙관적 업데이트를 하지 않는다.** `planItemId` 를 서버가 새로 발급하고,
 * `PLAN_004` 처럼 재시도로 풀리지 않는 실패가 있다.
 */
export function usePlanAddPlace({
  planId,
  onAdded,
}: {
  planId: string
  /** 저장 성공. 호출부가 화면을 정리한다(목록에서 돌아가기 등) */
  onAdded?: (place: { placeId: string; title: string }, day: number) => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  /** 담는 중인 장소. 목록에서 어느 행이 진행 중인지 표시하는 데 쓴다 */
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null)
  const [error, setError] = useState<PlanDaySaveError | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const addingRef = useRef(false)

  const add = useCallback(
    ({
      day,
      dayItems,
      place,
    }: {
      day: number
      /** 그 일자의 **현재 항목 전부**. 되싣지 않으면 일자가 비워진다 */
      dayItems: PlanItemDetail[]
      place: { placeId: string; title: string }
    }) => {
      if (addingRef.current) return
      addingRef.current = true
      setPendingPlaceId(place.placeId)
      setError(null)

      void replaceDayItems(planId, day, appendPlaceItemPayload(dayItems, day, place))
        .then((next) => {
          queryClient.setQueryData(planKeys.detail(planId), next)
          // 항목이 늘면 그날 기준 장소가 바뀔 수 있다 — 판정을 다시 받는다 (E3)
          void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })

          showToast({
            message: messages.plan.addPlaceToast
              .replace('{title}', withObjectParticle(place.title))
              .replace('{day}', String(day)),
          })
          onAdded?.(place, day)
        })
        .catch((cause: unknown) =>
          setError(
            toPlanDaySaveError(cause, {
              retriable: messages.plan.addPlaceErrorDescription,
              missingPlace: messages.plan.addPlaceMissingPlaceError,
            }),
          ),
        )
        .finally(() => {
          addingRef.current = false
          setPendingPlaceId(null)
        })
    },
    [planId, queryClient, showToast, onAdded],
  )

  return {
    add,
    pendingPlaceId,
    adding: pendingPlaceId !== null,
    error,
    clearError: useCallback(() => setError(null), []),
  }
}
