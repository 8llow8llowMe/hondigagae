'use client'

import { useEffect, useRef } from 'react'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { PlanEditableItemRow } from '@/features/plan/plan-editable-item-row'
import { useDragReorder } from '@/features/plan/use-drag-reorder'
import type { PlanDayEditFocus } from '@/features/plan/use-plan-day-edit'
import { messages } from '@/lib/messages'
import type { PlanDayEditItem } from '@/lib/plan/day-items'
import { hasUnresolvedPlace } from '@/lib/plan/detail'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 편집 중인 일자 — 아트보드 03 A(모바일) · B(데스크톱) · C(저장 실패).
 *
 * **표시 전용이다.** 상태와 저장은 `usePlanDayEdit` 가 갖는다.
 *
 * 순서를 바꾸는 길이 셋이고 **셋 다 같은 `onMove` 를 지난다** — 배열 조작 규칙이
 * 한 곳(`moveEditItem`)에만 있다.
 *  - `Alt+↑/↓` — 키보드 주 경로 (E6)
 *  - 이동 버튼 — 같은 일을 눌러서
 *  - **순번을 잡아 끌기** — 마우스·터치 (`useDragReorder`)
 *
 * **드래그 라이브러리는 여전히 넣지 않았다** (E8-1). 필요한 것이 세로 한 줄 목록의
 * 스왑뿐이라 Pointer Events 로 직접 처리한다 — 이유는 `use-drag-reorder.ts` 주석에 있다.
 */
export function PlanDayEditor({
  items,
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
  dirty: boolean
  saving: boolean
  error: PlanDaySaveError | null
  announcement: string
  /** 이동 직후 포커스를 받아야 할 대상. 없으면 `null` */
  focusTarget: PlanDayEditFocus | null
  onClearFocus: () => void
  /** `moveFocus` 를 넘기지 않으면 포커스가 옮겨진 항목을 따라간다 (버튼·키보드 경로) */
  onMove: (index: number, direction: 'up' | 'down', moveFocus?: boolean) => void
  onToggleRemoved: (index: number) => void
  onSave: () => void
  onCancel: () => void
}) {
  const upRefs = useRef<(HTMLButtonElement | null)[]>([])
  const downRefs = useRef<(HTMLButtonElement | null)[]>([])

  const drag = useDragReorder({ onMove })

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
            missing={hasUnresolvedPlace(entry.item)}
            upRef={(node) => {
              upRefs.current[index] = node
            }}
            downRef={(node) => {
              downRefs.current[index] = node
            }}
            rowRef={drag.registerRow(index)}
            dragging={drag.dragging === index}
            onHandlePointerDown={drag.onPointerDown}
            onHandlePointerMove={drag.onPointerMove}
            onHandlePointerEnd={drag.onPointerEnd}
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
