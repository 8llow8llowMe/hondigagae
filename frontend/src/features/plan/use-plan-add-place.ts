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

/** 진행 중이거나 실패한 담기가 **어느 일자의 무엇인지**. 일자를 잃으면 안 된다 */
export type PlanAddTarget = { day: number; placeId: string }

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

  /**
   * 담는 중인 대상. **`placeId` 만 들면 안 된다** — 같은 장소가 두 일자의 실내 대안으로
   * 나올 수 있어(그날 대표 장소 기준으로 뽑히므로 연속 우천일에 겹친다) `placeId` 만
   * 비교하면 두 일자의 행이 함께 진행 표시를 낸다.
   */
  const [pending, setPending] = useState<PlanAddTarget | null>(null)
  /** 실패도 **어느 일자에서** 났는지 들고 있어야 그 일자에만 알림이 남는다 */
  const [failure, setFailure] = useState<{ target: PlanAddTarget; error: PlanDaySaveError } | null>(
    null,
  )
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
      setPending({ day, placeId: place.placeId })
      setFailure(null)

      /*
        **`.then(onSuccess, onError)` 2인자 형태다.** `.then().catch()` 체인이면 성공
        후처리(`setQueryData` · 토스트 · `onAdded` 의 라우팅)에서 던진 예외가 저장 실패로
        분류돼 **저장은 됐는데 "담지 못했어요" 가 뜬다.**
      */
      void replaceDayItems(planId, day, appendPlaceItemPayload(dayItems, day, place))
        .then(
          (next) => {
            queryClient.setQueryData(planKeys.detail(planId), next)
            // 항목이 늘면 그날 기준 장소가 바뀔 수 있다 — 판정을 다시 받는다 (E3)
            void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
            /*
              **산책 위험도도 함께 버린다** (#625 · D15-6). 교체가 `planItemId` 를 전부
              새로 발급하므로 낡은 판정은 어느 행에도 붙지 않고 조용히 사라진다.
            */
            void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })

            showToast({
              message: messages.plan.addPlaceToast
                .replace('{title}', withObjectParticle(place.title))
                .replace('{day}', String(day)),
            })
            onAdded?.(place, day)
          },
          (cause: unknown) =>
            setFailure({
              target: { day, placeId: place.placeId },
              error: toPlanDaySaveError(cause, {
                retriable: messages.plan.addPlaceErrorDescription,
                missingPlace: messages.plan.addPlaceMissingPlaceError,
              }),
            }),
        )
        .finally(() => {
          addingRef.current = false
          setPending(null)
        })
    },
    [planId, queryClient, showToast, onAdded],
  )

  return {
    add,
    pending,
    failure,
    /**
     * 다른 담기가 진행 중이다. **일자와 무관하게 전부 잠근다** — 일괄 교체라 동시에 두
     * 요청을 보내면 나중 응답이 앞선 것을 덮어 한쪽이 사라진다.
     */
    adding: pending !== null,
  }
}
