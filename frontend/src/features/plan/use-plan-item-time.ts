'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { planKeys } from '@/features/plan/queries'
import { changeItemStartTime } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import { toItemStartTimeError } from '@/lib/plan/item-time-error'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 저장 뒤 상세 재조회를 기다리는 상한 (ms). 보통의 재조회는 이 안에 끝나 칩이 새 시각으로
 * 바뀐 뒤 닫히고, 재시도 · 오프라인으로 늘어지면 이만큼만 잠근다 (아래 성공 갈래 주석).
 */
const DETAIL_REFETCH_WAIT_MS = 1500

/**
 * 일정 목록에서 항목 하나의 시작 시각을 저장한다 — 이슈 #1028 · #1053 ·
 * `일자편집-세부명세.md` G3 · G4.
 *
 * **단건 API 다** (`PUT …/items/{planItemId}/start-time`, BE #1030). 행을 제자리에서 고치므로
 * `planItemId` 와 그 날의 `다녀옴` 체크가 남는다. #1028 에서는 일자 일괄 교체라 체크가 풀려
 * 모달이 초기화 경고를 냈다 — #1053 에서 그 경고와 일괄 교체 경로를 걷었다.
 *
 * **낙관적 업데이트를 하지 않는다** (`api-integration-guide.md` §7). `PLAN_005` 처럼 재시도로
 * 풀리지 않는 실패가 있어 롤백이 잦다 — 방문 체크(`use-plan-visit.ts`)와 같은 판단이다.
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
      dayItems,
      planItemId,
      startTime,
    }: {
      /** 그 일자의 현재 항목. 저장은 한 항목뿐이고, 여기서는 **들고 있는 상세에 있는지**만 본다 */
      dayItems: PlanItemDetail[]
      planItemId: string
      /** `HH:mm:ss`. `null` 이면 지운다 */
      startTime: string | null
    }) => {
      if (savingRef.current) return

      const target = dayItems.find((item) => item.planItemId === planItemId)
      /*
        **들고 있는 상세에 그 항목이 없다** — 다른 탭에서 일정이 바뀌어 낡은 상세로 누른
        것이다. 보내 봐야 `PLAN_005` 라 보내지 않고 새로고침을 안내한다 (`PLAN_002` 와 같은 결).
      */
      if (target === undefined) {
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
      void changeItemStartTime(planId, planItemId, startTime)
        .then(
          async () => {
            /*
              **상세는 무효화로만 이어받는다.** 응답이 `Response<Void>` 라 갈아끼울 상세가 없고,
              시각을 `setQueryData` 로 지어 넣지 않는다 — 정본은 plan-service 다(서버가 `HH:mm`
              을 `HH:mm:ss` 로 고쳐 들기도 한다). 방문 체크(`use-plan-visit.ts`)와 같은 경로다.

              **재조회를 기다린 뒤 닫는다.** 먼저 닫으면 "저장했어요" 토스트 아래 칩이 한동안
              옛 시각을 보여 준다. 그동안 `saving` 이 남아 저장 · 닫기가 잠긴다. 재조회가
              실패해도 `invalidateQueries` 는 던지지 않는다 — 저장은 됐으므로 그대로 닫는다.

              **다만 오래 기다리지 않는다** (`DETAIL_REFETCH_WAIT_MS`). 재조회가 5xx 면 전역
              retry 가 끝날 때까지(1초 · 2초 backoff) 잠기고, 저장 직후 오프라인이 되면 재조회가
              재연결 전까지 멈춰 **저장은 됐는데 모달을 닫을 방법이 없어진다.** 상한을 넘기면
              재조회는 뒤에서 계속 돌게 두고 닫는다 — 그 사이 칩이 잠깐 옛 시각인 것은 감수한다.
            */
            // 바뀐 시각이 곧 그 항목의 판정 입력이다 (D15-6). 따로 받는 절이라 기다리지 않는다
            void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })
            /*
              **판정(`planKeys.weather`)은 무효화하지 않는다.** 일자 판정은 항목 구성·순서(첫 장소
              항목)로 계산되고 시각을 읽지 않는다(`PlanWeatherProcessor` 실측) — 방문 체크와
              같은 판단이다. 일괄 교체 시절에는 교체라서 무효화했다.
            */
            await Promise.race([
              queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) }),
              new Promise<void>((resolve) => setTimeout(resolve, DETAIL_REFETCH_WAIT_MS)),
            ])

            showToast({
              message: (startTime === null
                ? messages.plan.itemTimeClearedToast
                : messages.plan.itemTimeSavedToast
              ).replace('{title}', target.title),
            })
            onSaved?.()
          },
          (cause: unknown) => setFailure({ planItemId, error: toItemStartTimeError(cause) }),
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
