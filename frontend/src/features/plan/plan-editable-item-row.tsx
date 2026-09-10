'use client'

import type { KeyboardEvent, PointerEvent as ReactPointerEvent, Ref } from 'react'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { ChevronDownIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import type { MoveDirection, PlanDayEditItem } from '@/lib/plan/day-items'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 편집 중인 항목 행 — 아트보드 03 A·B.
 *
 * **썸네일이 없고 행이 낮다.** 드래그 대상은 순서지 사진이 아니다 (E4).
 * 거리 자리에는 숫자 대신 안내 문장이 들어간다 — 순서를 옮길 때마다 숫자가 흔들리면
 * 신뢰가 깨진다.
 *
 * **삭제는 배열에서 빼지 않는다.** 취소선 + `복구` 로 보류하고, 색·선만으로 알리지 않게
 * `저장하면 삭제돼요` 문구를 함께 낸다 (E6).
 *
 * **행 자체를 포커스 대상으로 만들지 않는다.** 조작하는 것은 이동·삭제 버튼이고, 그것들이
 * 이미 네이티브 `button` 이다. 행에 `tabIndex` + `onKeyDown` 을 얹으면 역할 없는 요소가
 * 상호작용을 갖게 되어 스크린리더가 무엇을 눌러야 하는지 말하지 못한다.
 *
 * **순번 배지가 드래그 손잡이다** (`useDragReorder`). 손잡이를 따로 두면 좁은 화면에서
 * 제목이 들어갈 폭이 사라진다 — 순번은 이미 "몇 번째인가" 를 말하는 자리라, 그것을
 * 잡아 위치를 바꾸는 것이 뜻으로도 맞다.
 *
 * 손잡이는 **마우스·터치 전용 보조 경로**라 `aria-hidden` 이다. 순서 정보는 `<ol>` 이,
 * 키보드 경로는 이동 버튼과 `Alt+↑/↓` 가 이미 갖고 있다 — 포커스 가능한 컨트롤을 하나 더
 * 늘리면 같은 일을 하는 탭 정지가 행마다 셋이 된다.
 */
export function PlanEditableItemRow({
  entry,
  index,
  total,
  missing,
  upRef,
  downRef,
  onMove,
  onToggleRemoved,
  rowRef,
  dragging = false,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerEnd,
}: {
  entry: PlanDayEditItem
  index: number
  total: number
  /**
   * 장소를 가리키는데 `place` 요약이 오지 않았다 — 저장이 `PLAN_004` 로 막힐 후보다 (E1).
   * **원인은 단정하지 않는다** — delisting 일 수도, tour-service 일시 장애일 수도 있다.
   */
  missing: boolean
  /** 이동 후 포커스를 따라가게 하려고 호출부가 붙인다 */
  upRef: (node: HTMLButtonElement | null) => void
  downRef: (node: HTMLButtonElement | null) => void
  onMove: (index: number, direction: MoveDirection) => void
  onToggleRemoved: (index: number) => void
  /**
   * 이웃 행의 중간선을 재려면 실제 노드가 필요하다 — `useDragReorder` 가 붙인다.
   *
   * **`li` 가 아니라 그 안의 줄에 붙는다.** 중간선 계산에
   * 필요한 것은 "이 행이 화면에서 차지하는 세로 구간" 이고, 세로 padding 을 들고 있는
   * 이 줄의 사각형이 곧 그 값이다.
   */
  rowRef?: Ref<HTMLDivElement>
  /** 지금 끌고 있는 행인가. 손 아래에 있는 것이 무엇인지 보이게 한다 */
  dragging?: boolean
  onHandlePointerDown?: (index: number, event: ReactPointerEvent<HTMLElement>) => void
  onHandlePointerMove?: (event: ReactPointerEvent<HTMLElement>) => void
  onHandlePointerEnd?: (event: ReactPointerEvent<HTMLElement>) => void
}) {
  const first = index === 0
  const bottom = index === total - 1

  /**
   * `Alt+↑/↓` 가 **주 경로**다 (E6). 이동 버튼에 포커스가 있는 채로 눌러 연속 이동한다.
   *
   * `Alt` 를 요구하는 이유는 방향키만으로는 페이지 스크롤·스크린리더 읽기 이동과
   * 충돌하기 때문이다.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey) return
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

    event.preventDefault()
    onMove(index, event.key === 'ArrowUp' ? 'up' : 'down')
  }

  return (
    <li
      /*
        카드 안의 L2 항목 — 인셋은 카드 값, 구분선은 목록(`ol`)이 사이에만 긋는다 (#447).

        끌고 있는 행을 띄운다. **`--shadow-md` 는 "실제로 떠 있는 것" 에만 허용되는데
        DESIGN.md §6 이 그 목록에 `드래그 중인 항목` 을 명시한다.** 배경(`bg-bg`)도 그때만
        갖는다 — 떠 있는 행이 아래 행을 가려야 한다. `relative z-10` 이 없으면 그림자가
        아래 행에 가린다.
      */
      className={cn(INSET_CLASS.card, dragging && 'bg-bg relative z-10 shadow-md')}
    >
      {/* 끄는 동안 글자가 선택되면 드래그가 텍스트 선택으로 바뀐다 */}
      <div ref={rowRef} className={cn('flex items-center gap-3 py-2', dragging && 'select-none')}>
        <span
          aria-hidden
          title={messages.plan.editDragHandle}
          onPointerDown={(event) => onHandlePointerDown?.(index, event)}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerEnd}
          onPointerCancel={onHandlePointerEnd}
          className={cn(
            'bg-band text-fg-muted text-caption flex w-6 shrink-0 items-center justify-center self-stretch rounded-sm font-bold tabular-nums',
            // 터치에서 드래그가 스크롤로 먹히지 않게 한다
            'touch-none',
            onHandlePointerDown === undefined ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-body-1 min-w-0 font-semibold break-words',
                // 취소선은 시각 채널이다. 아래 문구가 같은 뜻을 글로 말한다
                entry.removed ? 'text-fg-subtle line-through' : 'text-fg',
              )}
            >
              {entry.item.title}
            </span>
            {entry.item.itemType.code !== 'PLACE' && (
              <Badge size="sm">{entry.item.itemType.name}</Badge>
            )}
          </div>

          {entry.removed && (
            <p className="text-caption text-fg-muted mt-1 font-medium">
              {messages.plan.editRemoveMark}
            </p>
          )}

          {/* 저장이 PLAN_004 로 막히는 원인 후보다. 서버가 어느 항목인지 알려주지
              않으므로 상세에서 이미 알고 있는 404 로 미리 짚는다 (E1) */}
          {missing && !entry.removed && (
            <p className="text-caption text-metric-low-700 mt-1 font-medium">
              {messages.plan.editMissingPlaceMark}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            ref={upRef}
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={messages.plan.editMoveUp}
            disabled={first}
            leading={<ChevronDownIcon size={18} className="rotate-180" />}
            onKeyDown={handleKeyDown}
            onClick={() => onMove(index, 'up')}
          />
          <Button
            ref={downRef}
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={messages.plan.editMoveDown}
            disabled={bottom}
            leading={<ChevronDownIcon size={18} />}
            onKeyDown={handleKeyDown}
            onClick={() => onMove(index, 'down')}
          />
          <Button variant="secondary" size="sm" onClick={() => onToggleRemoved(index)}>
            {entry.removed ? messages.plan.editRestore : messages.plan.editRemove}
          </Button>
        </div>
      </div>
    </li>
  )
}
