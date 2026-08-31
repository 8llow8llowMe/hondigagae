'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
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

/** 저장 실패를 화면이 어떻게 다뤄야 하는가 */
export type PlanDayEditError = {
  message: string
  /** `false` 면 `다시 시도` 를 주지 않는다 — 같은 본문이 같은 400 을 받는다 */
  retriable: boolean
}

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
  const [error, setError] = useState<PlanDayEditError | null>(null)
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

  const move = useCallback((index: number, direction: MoveDirection) => {
    setItems((current) => {
      const next = moveEditItem(current, index, direction)
      // 경계에서는 같은 배열이 온다 — 알림도 포커스 이동도 하지 않는다
      if (next === current) return current

      const moved = direction === 'up' ? index - 1 : index + 1
      setFocusTarget({ index: moved, direction })
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
      .catch((cause: unknown) => setError(toEditError(cause)))
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

/**
 * 저장 실패를 문구와 재시도 가능 여부로 옮긴다.
 *
 * **`PLAN_004` 와 `PLAN_002` 에는 재시도를 주지 않는다.** 둘 다 같은 본문을 다시
 * 보내면 같은 400 이다 — `PLAN_004` 는 원천에서 사라진 장소가 담겨 있는 것이고,
 * `PLAN_002` 는 들고 있는 상세가 낡은 것이다.
 */
function toEditError(cause: unknown): PlanDayEditError {
  if (cause instanceof ApiError) {
    if (cause.resultCode === 'PLAN_004') {
      return { message: messages.plan.editMissingPlaceError, retriable: false }
    }
    if (cause.resultCode === 'PLAN_002') {
      return { message: messages.plan.editDayOutOfRangeError, retriable: false }
    }
  }

  return { message: messages.plan.editSaveErrorDescription, retriable: true }
}
