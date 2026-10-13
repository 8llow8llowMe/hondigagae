'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { invalidatePlanBriefing } from '@/features/plan/plan-briefing-invalidation'
import { planKeys } from '@/features/plan/queries'
import { replaceDayItems } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import {
  editStartTimesRegress,
  hasEditChanges,
  type MoveDirection,
  moveEditItem,
  type PlanDayEditItem,
  planDayItemsPayload,
  survivingItems,
  toEditItems,
  toggleRemoved,
} from '@/lib/plan/day-items'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
import { startTimesLine } from '@/lib/plan/time-order'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 일자 편집 로컬 상태 + 저장 mutation.
 *
 * **서버 상태를 건드리지 않는다.** 순서 바꾸기와 삭제 표시는 전부 로컬이고, 저장
 * 성공 시에만 응답으로 캐시를 갈아끼운다.
 *
 * **낙관적 업데이트를 하지 않는다** — `planItemId` 가 서버에서 새로 발급되고,
 * `PLAN_004` 처럼 재시도로 풀리지 않는 실패가 있다 (E3).
 */

/** 이동 직후 포커스를 받아야 할 대상 */
export type PlanDayEditFocus = { index: number; direction: MoveDirection }

export function usePlanDayEdit({
  planId,
  onSaved,
}: {
  planId: string
  /** 저장 성공. 호출부가 편집모드를 닫는다 */
  onSaved: () => void
}) {
  const queryClient = useQueryClient()

  const [items, setItems] = useState<PlanDayEditItem[]>([])
  const [original, setOriginal] = useState<PlanItemDetail[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<PlanDaySaveError | null>(null)
  /** 이동·삭제를 스크린리더에 알린다 (E6) */
  const [announcement, setAnnouncement] = useState('')
  /**
   * 이동 후 포커스를 따라가게 하려고 대상을 기억한다. **방향까지 들고 있어야 한다** —
   * 같은 방향 버튼이 경계에서 `disabled` 가 되면 반대쪽으로 옮겨야 하기 때문이다.
   */
  const [focusTarget, setFocusTarget] = useState<PlanDayEditFocus | null>(null)
  /**
   * "시각도 순서에 맞게 다시 맞출까요?" 확인 (#1424). 값은 지금 순서대로의 시각 줄이고, 묻지 않는
   * 동안은 `null` 이다. **순서나 삭제 표시를 바꾸면 접는다** — 물은 근거가 낡는다.
   */
  const [timeRealign, setTimeRealign] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 저장을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  const start = useCallback((dayItems: PlanItemDetail[]) => {
    setItems(toEditItems(dayItems))
    setOriginal(dayItems)
    setError(null)
    setAnnouncement('')
    setFocusTarget(null)
    setTimeRealign(null)
  }, [])

  /**
   * 한 칸 이동.
   *
   * `moveFocus` 는 **드래그 때문에 생긴 인자다.** 버튼·키보드로 옮길 때는 포커스가
   * 옮겨진 항목을 따라가야 연속 이동이 되지만(E6), 끌어서 옮기는 중에 `.focus()` 를
   * 부르면 브라우저가 그 요소를 화면 안으로 스크롤해 손가락 아래의 목록이 튄다.
   * **알림(`aria-live`)은 양쪽 다 낸다** — 무엇이 몇 번째로 갔는지는 어느 쪽이든 알아야 한다.
   */
  const move = useCallback((index: number, direction: MoveDirection, moveFocus = true) => {
    setItems((current) => {
      const next = moveEditItem(current, index, direction)
      // 경계에서는 같은 배열이 온다 — 알림도 포커스 이동도 하지 않는다
      if (next === current) return current

      setTimeRealign(null)
      const moved = direction === 'up' ? index - 1 : index + 1
      if (moveFocus) setFocusTarget({ index: moved, direction })
      setAnnouncement(messages.plan.editAnnounceMoved.replace('{position}', String(moved + 1)))
      return next
    })
  }, [])

  const toggle = useCallback((index: number) => {
    setItems((current) => {
      const next = toggleRemoved(current, index)
      setTimeRealign(null)
      setAnnouncement(
        next[index]?.removed === true
          ? messages.plan.editAnnounceRemoved
          : messages.plan.editAnnounceRestored,
      )
      return next
    })
  }, [])

  const dirty = hasEditChanges(items, original)

  /**
   * 저장. **저장하면 남을 항목의 시각이 역행하면 먼저 묻는다** (#1424) — 순서 편집은 시각을
   * 고치지 않고 원문을 되싣기 때문에(#1028 · G0) `10:00 → 15:00 → 12:30` 이 그대로 확정됐다.
   * 자동으로 고치지 않는다: 어느 쪽(순서 · 시각)이 맞는지는 사용자만 안다. 답은
   * `saveWithTimes` 로 온다.
   */
  function save(day: number) {
    if (savingRef.current) return
    if (editStartTimesRegress(items)) {
      setTimeRealign(startTimesLine(survivingItems(items).map((item) => item.startTime)))
      return
    }
    commit(day, false)
  }

  /** 확인에 답한 저장 — `realign` 이면 있던 시각을 순서대로 다시 나눠 싣는다 */
  function saveWithTimes(day: number, realign: boolean) {
    if (savingRef.current) return
    commit(day, realign)
  }

  function commit(day: number, realign: boolean) {
    savingRef.current = true
    setSaving(true)
    setError(null)

    void replaceDayItems(
      planId,
      day,
      planDayItemsPayload(items, day, { realignStartTimes: realign }),
    )
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(planId), next)
        /*
          **판정을 무효화한다.** `PlanDayWeatherItem` 은 그날 **첫 장소 항목**을 기준으로
          판정하므로(컨트롤러 설명) 순서를 바꾸면 기준 장소가 바뀐다.
        */
        void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
        /*
          **산책 위험도도 함께 버린다** (#625 · D15-6). 순서 편집은 판정 입력(기준 장소)을
          바꿀 수 있고, 저장은 `planItemId` 를 전부 새로 발급하므로 무효화하지 않으면 낡은
          판정이 어느 행에도 붙지 않고 사라진다.
        */
        void queryClient.invalidateQueries({ queryKey: planKeys.walkSafety(planId) })
        // 순서가 바뀌면 브리핑의 첫/마지막 항목 · 대표 장소가 바뀐다 (#1055)
        void invalidatePlanBriefing(queryClient, planId)
        // 저장하면 planItemId 가 전부 새로 발급된다 — 편집 상태를 통째로 버린다 (E1 규칙 3)
        setItems([])
        setOriginal([])
        setFocusTarget(null)
        setTimeRealign(null)
        onSaved()
      })
      .catch((cause: unknown) =>
        setError(
          toPlanDaySaveError(cause, {
            retriable: messages.plan.editSaveErrorDescription,
            missingPlace: messages.plan.editMissingPlaceError,
          }),
        ),
      )
      .finally(() => {
        savingRef.current = false
        setSaving(false)
      })
  }

  return {
    items,
    dirty,
    saving,
    error,
    announcement,
    focusTarget,
    clearFocus: useCallback(() => setFocusTarget(null), []),
    start,
    move,
    toggle,
    save,
    saveWithTimes,
    timeRealign,
  }
}
