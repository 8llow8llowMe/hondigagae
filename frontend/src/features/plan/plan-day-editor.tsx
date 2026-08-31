'use client'

import { useEffect, useRef } from 'react'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { PlanEditableItemRow } from '@/features/plan/plan-editable-item-row'
import type { PlanDayEditFocus } from '@/features/plan/use-plan-day-edit'
import { messages } from '@/lib/messages'
import type { PlanDayEditItem } from '@/lib/plan/day-items'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 편집 중인 일자 — 아트보드 03 A(모바일) · B(데스크톱) · C(저장 실패).
 *
 * **표시 전용이다.** 상태와 저장은 `usePlanDayEdit` 가 갖는다.
 *
 * 키보드만으로 완결된다 — `Alt+↑/↓` 가 주 경로고 이동 버튼이 같은 일을 한다.
 * **드래그 라이브러리를 넣지 않았다** (E8-1): 의존성 하나를 이 화면 하나로 들이지 않는다.
 */
export function PlanDayEditor({
  items,
  missing,
  dirty,
  saving,
  error,
  announcement,
  focusTarget,
  onClearFocus,
  onMove,
  onToggleRemoved,
  onSave,
  onCancel,
}: {
  items: PlanDayEditItem[]
  /** 장소 조회가 404 인 placeId — 저장이 `PLAN_004` 로 막힐 후보다 */
  missing: Set<string>
  dirty: boolean
  saving: boolean
  error: PlanDaySaveError | null
  announcement: string
  /** 이동 직후 포커스를 받아야 할 대상. 없으면 `null` */
  focusTarget: PlanDayEditFocus | null
  onClearFocus: () => void
  onMove: (index: number, direction: 'up' | 'down') => void
  onToggleRemoved: (index: number) => void
  onSave: () => void
  onCancel: () => void
}) {
  const upRefs = useRef<(HTMLButtonElement | null)[]>([])
  const downRefs = useRef<(HTMLButtonElement | null)[]>([])

  /*
    **이동 후 포커스가 옮겨진 항목을 따라간다** (E6). 이것이 없으면 한 칸 옮길 때마다
    포커스가 body 로 떨어져 연속 이동이 불가능하다 — 키보드가 주 경로인데 한 번밖에
    못 쓰게 된다.

    같은 방향 버튼을 우선 잡되, **경계에서 그 버튼이 `disabled` 면 반대쪽으로 옮긴다** —
    disabled 요소는 포커스를 받지 못해 그대로 두면 포커스가 사라진다.
  */
  useEffect(() => {
    if (focusTarget === null) return

    const { index, direction } = focusTarget
    const same = (direction === 'up' ? upRefs : downRefs).current[index]
    const other = (direction === 'up' ? downRefs : upRefs).current[index]

    if (same !== null && same !== undefined && !same.disabled) same.focus()
    else other?.focus()

    onClearFocus()
  }, [focusTarget, onClearFocus])

  return (
    <div className="py-2">
      <p className="text-caption text-fg-muted px-4 font-medium md:px-10">
        {messages.plan.editHint}
      </p>

      {/* 순서가 뜻을 갖는 목록이라 ol 이다 (E6) */}
      <ol className="mt-2">
        {items.map((entry, index) => (
          <PlanEditableItemRow
            key={entry.item.planItemId}
            entry={entry}
            index={index}
            total={items.length}
            missing={entry.item.targetId !== null && missing.has(entry.item.targetId)}
            upRef={(node) => {
              upRefs.current[index] = node
            }}
            downRef={(node) => {
              downRefs.current[index] = node
            }}
            onMove={onMove}
            onToggleRemoved={onToggleRemoved}
            last={index === items.length - 1}
          />
        ))}
      </ol>

      {/* 순서를 옮길 때마다 거리 숫자가 흔들리면 신뢰가 깨진다 — 숫자 대신 안내다 (E4) */}
      <p className="text-caption text-fg-muted mt-3 px-4 font-medium md:px-10">
        {messages.plan.editDistanceNote}
      </p>

      {/* 이동·삭제 표시를 스크린리더에 알린다. 시각으로만 전달하지 않는다 (E6) */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="mt-3 flex flex-col gap-2 px-4 md:px-10">
        {error !== null && (
          <FormAlert
            message={
              error.retriable
                ? `${messages.plan.editSaveErrorTitle} — ${error.message}`
                : error.message
            }
          />
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={onSave}
            loading={saving}
            disabled={!dirty}
            // 잠긴 이유를 보이지 않는 힌트로만 두지 않는다 (E6)
            {...(dirty ? {} : { 'aria-describedby': 'plan-edit-no-changes' })}
          >
            {messages.plan.editSave}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {messages.plan.editCancel}
          </Button>
        </div>

        {!dirty && (
          <p id="plan-edit-no-changes" className="text-caption text-fg-muted">
            {messages.plan.editNoChanges}
          </p>
        )}
      </div>
    </div>
  )
}
