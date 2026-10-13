'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { invalidatePlanBriefing } from '@/features/plan/plan-briefing-invalidation'
import { planKeys } from '@/features/plan/queries'
import { markItemVisited, replaceDayItems } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import { setItemMemoPayload, visitsToRestore } from '@/lib/plan/item-memo-edit'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
import type { PlanItemDetail } from '@/types/plan'

/** 되살리기 뒤 상세 재조회를 기다리는 상한 (ms). `use-plan-item-time.ts` 와 같은 값이다 */
const DETAIL_REFETCH_WAIT_MS = 1500

/**
 * 일정 상세에서 항목 하나의 메모를 고치거나 지운다 — 이슈 #1460 · `일정상세-세부명세.md` D30.
 *
 * **일자 일괄 교체다** (`PUT …/days/{day}/items`). 항목 단건 수정 API 는 `visited` · `startTime`
 * 뿐이다. 저장 후처리는 이동·휴식 추가(`use-plan-add-move.ts`)와 같다 — 응답으로 상세를 갈아끼우고
 * 판정 · 산책 위험도 · 브리핑을 버린다.
 *
 * **교체가 푼 `다녀옴` 을 되살린다** (D30-3). 교체는 그 일자 항목을 새로 만들어 `visited` 가
 * 전부 `false` 가 된다 — 메모 한 줄 고쳤는데 여행 중 남긴 체크가 사라지면 안 된다. 담기 · 이동
 * 추가처럼 "초기화돼요" 로 알리고 끝내지 않는 이유: 그쪽은 일자 구성이 바뀌는 일이고, 이쪽은
 * 사용자가 보기에 아무 구성도 바뀌지 않는다. 되살리기는 단건 `…/visited` 를 자리마다 한 번씩이다.
 *
 * **낙관적 업데이트를 하지 않는다** (`api-integration-guide.md` §7).
 */
export function usePlanItemMemo({
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
      memo,
    }: {
      day: number
      /** 그 일자의 **현재 항목 전부**(순번대로). 되싣지 않으면 일자가 비워진다 */
      dayItems: PlanItemDetail[]
      planItemId: string
      /** 새 메모. `null` 이나 빈 값이면 지운다 */
      memo: string | null
    }) => {
      if (savingRef.current) return

      const target = dayItems.find((item) => item.planItemId === planItemId)
      const payload = setItemMemoPayload(dayItems, day, planItemId, memo)
      /*
        **들고 있는 상세에 그 항목이 없다** — 다른 탭에서 일정이 바뀌어 낡은 상세로 누른 것이다.
        보내면 그 탭이 바꾼 일자를 옛 목록으로 덮는다. 새로고침을 안내한다 (시간 칩과 같은 결).
      */
      if (target === undefined || payload === null) {
        setFailure({
          planItemId,
          error: { message: messages.plan.saveStaleError, retriable: false },
        })
        return
      }

      savingRef.current = true
      setSaving(true)
      setFailure(null)

      // 비우고 저장한 것도 지우기다 — 본문이 그 항목의 memo 키를 뺀다 (`setItemMemoPayload`)
      const clearing = (memo ?? '').trim() === ''
      const toast = (
        clearing ? messages.plan.itemMemoClearedToast : messages.plan.itemMemoSavedToast
      ).replace('{title}', target.title)

      /*
        **`.then(onSuccess, onError)` 2인자 형태다** (`use-plan-add-move.ts` 와 같다). 되살리기
        실패가 저장 실패로 분류되면 **저장은 됐는데 "저장하지 못했어요" 가 뜬다.**
      */
      void replaceDayItems(planId, day, payload)
        .then(
          async (next) => {
            queryClient.setQueryData(planKeys.detail(planId), next)
            // 교체가 planItemId 를 전부 새로 발급한다 — 낡은 판정은 어느 행에도 안 붙는다 (D15-6)
            void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })
            // 판정이 메모를 읽지 않는다고 화면이 가려내면 서버 규칙을 복제한다 — 조회 한 번이다 (E3)
            void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
            void invalidatePlanBriefing(queryClient, planId)

            const after = next.items
              .filter((item) => item.day === day)
              .sort((a, b) => a.sequence - b.sequence)
            const restoring = visitsToRestore(dayItems, after)
            let restoreFailed = false

            if (restoring.length > 0) {
              /*
                **자리마다 한 번씩, 하나가 실패해도 나머지는 보낸다** (`allSettled`). 서로 다른
                항목이라 겹쳐도 충돌하지 않는다(`use-plan-visit.ts` 와 같은 판단). 끝나면 상세를
                다시 받는다 — 응답이 `Response<Void>` 라 갈아끼울 상세가 없다.
              */
              const results = await Promise.allSettled(
                restoring.map((id) => markItemVisited(planId, id, true)),
              )
              restoreFailed = results.some((result) => result.status === 'rejected')
              /*
                재조회를 기다린 뒤 닫되 **오래 기다리지 않는다** — 근거는 `use-plan-item-time.ts` 의
                `DETAIL_REFETCH_WAIT_MS` 주석(5xx 재시도 · 오프라인이면 모달을 닫을 길이 없어진다).
              */
              await Promise.race([
                queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) }),
                new Promise<void>((resolve) => setTimeout(resolve, DETAIL_REFETCH_WAIT_MS)),
              ])
            }

            showToast({
              message: restoreFailed ? messages.plan.itemMemoVisitRestoreFailedToast : toast,
            })
            onSaved?.()
          },
          (cause: unknown) =>
            setFailure({
              planItemId,
              error: toPlanDaySaveError(cause, {
                retriable: messages.plan.itemMemoErrorDescription,
                missingPlace: messages.plan.itemMemoMissingPlaceError,
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
