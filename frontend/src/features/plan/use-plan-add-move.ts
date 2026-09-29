'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { planKeys } from '@/features/plan/queries'
import { replaceDayItems } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import { appendMoveItemPayload } from '@/lib/plan/day-items'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
import { withObjectParticle } from '@/lib/text/korean'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 일자에 이동·휴식(`MOVE`) 항목 하나를 붙인다 — 이슈 #1014 · `일자편집-세부명세.md` H3.
 *
 * **`usePlanAddPlace` 와 저장 후처리가 같다.** 같은 `PUT …/days/{day}/items` 일괄 교체라
 * 응답으로 상세를 갈아끼우고 판정 · 산책 위험도를 버린다 (E3 · D15-6). 훅을 합치지 않은
 * 것은 **진행·실패를 드는 열쇠가 달라서다** — 장소 담기는 `{day, placeId}` 로 행 하나를
 * 가리키고(같은 장소가 두 일자의 대안일 수 있다), 이쪽은 모달 하나라 일자만 들면 된다.
 *
 * **낙관적 업데이트를 하지 않는다.** `planItemId` 를 서버가 새로 발급하고 `PLAN_004` 처럼
 * 재시도로 풀리지 않는 실패가 있다 (`use-plan-add-place.ts` 와 같은 판단).
 */
export function usePlanAddMove({
  planId,
  onAdded,
}: {
  planId: string
  /** 저장 성공. 호출부가 모달을 닫는다 */
  onAdded?: (day: number) => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  /** 추가 중인 일자 */
  const [pendingDay, setPendingDay] = useState<number | null>(null)
  /** 실패도 **어느 일자에서** 났는지 든다 — 다른 일자의 모달을 열면 그 알림이 없어야 한다 */
  const [failure, setFailure] = useState<{ day: number; error: PlanDaySaveError } | null>(null)
  // disabled 반영 전 빠른 연속 제출(Enter 두 번)을 막는다 (form-guide.md §6)
  const addingRef = useRef(false)

  const add = useCallback(
    ({
      day,
      dayItems,
      title,
    }: {
      day: number
      /** 그 일자의 **현재 항목 전부**. 되싣지 않으면 일자가 비워진다 */
      dayItems: PlanItemDetail[]
      title: string
    }) => {
      if (addingRef.current) return
      addingRef.current = true
      setPendingDay(day)
      setFailure(null)

      const payload = appendMoveItemPayload(dayItems, day, { title })
      // 토스트는 **실제로 보낸 제목**을 말한다 — 입력값에는 앞뒤 공백이 남아 있을 수 있다
      const sentTitle = payload.items.at(-1)?.title ?? title

      /*
        **`.then(onSuccess, onError)` 2인자 형태다** (`use-plan-add-place.ts` 와 같다).
        `.then().catch()` 면 성공 후처리에서 던진 예외가 저장 실패로 분류돼 **저장은 됐는데
        "추가하지 못했어요" 가 뜬다.**
      */
      void replaceDayItems(planId, day, payload)
        .then(
          (next) => {
            queryClient.setQueryData(planKeys.detail(planId), next)
            /*
              **`MOVE` 는 판정의 기준 장소가 될 수 없지만 판정을 그대로 버린다.** 서버 판정은
              항목 배열로 계산되고, 여기서 "이 교체는 판정과 무관하다" 를 화면이 가려내면
              서버 규칙을 복제하게 된다. 값은 조회 한 번이다 (E3).
            */
            void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
            // 교체가 planItemId 를 전부 새로 발급한다 — 낡은 판정은 어느 행에도 안 붙는다 (D15-6)
            void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })

            showToast({
              message: messages.plan.addMoveToast
                .replace('{title}', withObjectParticle(sentTitle))
                .replace('{day}', String(day)),
            })
            onAdded?.(day)
          },
          (cause: unknown) =>
            setFailure({
              day,
              error: toPlanDaySaveError(cause, {
                retriable: messages.plan.addMoveErrorDescription,
                missingPlace: messages.plan.addMoveMissingPlaceError,
              }),
            }),
        )
        .finally(() => {
          addingRef.current = false
          setPendingDay(null)
        })
    },
    [planId, queryClient, showToast, onAdded],
  )

  /** 모달을 닫거나 다른 일자로 열 때 지난 실패를 걷는다 */
  const clearFailure = useCallback(() => setFailure(null), [])

  return {
    add,
    pendingDay,
    failure,
    clearFailure,
    /** 추가가 진행 중이다. 일괄 교체라 그동안 같은 계열 저장을 전부 잠근다 */
    adding: pendingDay !== null,
  }
}
