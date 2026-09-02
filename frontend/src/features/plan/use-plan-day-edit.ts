'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { planKeys } from '@/features/plan/queries'
import { replaceDayItems } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import {
  hasEditChanges,
  type MoveDirection,
  moveEditItem,
  type PlanDayEditItem,
  planDayItemsPayload,
  toEditItems,
  toggleRemoved,
} from '@/lib/plan/day-items'
import { type PlanDaySaveError, toPlanDaySaveError } from '@/lib/plan/save-error'
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
  // disabled 반영 전 빠른 연속 저장을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  const start = useCallback((dayItems: PlanItemDetail[]) => {
    setItems(toEditItems(dayItems))
    setOriginal(dayItems)
    setError(null)
    setAnnouncement('')
    setFocusTarget(null)
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

      const moved = direction === 'up' ? index - 1 : index + 1
      if (moveFocus) setFocusTarget({ index: moved, direction })
      setAnnouncement(messages.plan.editAnnounceMoved.replace('{position}', String(moved + 1)))
      return next
    })
  }, [])

  const toggle = useCallback((index: number) => {
    setItems((current) => {
      const next = toggleRemoved(current, index)
      setAnnouncement(
        next[index]?.removed === true
          ? messages.plan.editAnnounceRemoved
          : messages.plan.editAnnounceRestored,
      )
      return next
    })
  }, [])

  const dirty = hasEditChanges(items, original)

  function save(day: number) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)

    void replaceDayItems(planId, day, planDayItemsPayload(items, day))
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(planId), next)
        /*
          **판정을 무효화한다.** `PlanDayWeatherItem` 은 그날 **첫 장소 항목**을 기준으로
          판정하므로(컨트롤러 설명) 순서를 바꾸면 기준 장소가 바뀐다.
        */
        void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
        // 저장하면 planItemId 가 전부 새로 발급된다 — 편집 상태를 통째로 버린다 (E1 규칙 3)
        setItems([])
        setOriginal([])
        setFocusTarget(null)
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
  }
}
