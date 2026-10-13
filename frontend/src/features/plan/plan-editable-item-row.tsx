'use client'

import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  Ref,
} from 'react'

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
 * **카드 전체가 드래그 손잡이다** (#1029 · `useDragReorder`). 전에는 순번 배지만 잡을 수
 * 있었는데, 폭 24px 의 번호를 정확히 짚어야 해서 모바일에서 끌기를 찾지도, 잡지도 못했다.
 * 버튼 위에서 시작한 누름은 끌기가 아니다 — 판정은 `lib/plan/drag-gesture.ts`.
 *
 * 끌기는 **마우스·터치 전용 보조 경로**라 카드에 역할·`tabIndex`·`aria-*` 를 더하지 않는다.
 * 순서 정보는 `<ol>` 이, 키보드 경로는 이동 버튼과 `Alt+↑/↓` 가 이미 갖고 있다 — 카드를
 * 포커스 가능하게 만들면 같은 일을 하는 탭 정지가 행마다 하나 더 는다. 순번 배지는 그대로
 * `aria-hidden` 이다 (`<ol>` 이 이미 순번을 읽는다).
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
  onDragPointerDown,
  onDragContextMenu,
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
  /** 카드 어디든 누르면 부른다. 없으면 끌 수 없는 행이다 */
  onDragPointerDown?: (index: number, event: ReactPointerEvent<HTMLElement>) => void
  /** 길게 누르는 동안 뜨는 메뉴를 막는다 */
  onDragContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void
}) {
  const first = index === 0
  const bottom = index === total - 1
  const draggable = onDragPointerDown !== undefined

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

        끌고 있는 행을 **들린 모양**으로 띄운다 (#1029). **`--shadow-md` 는 "실제로 떠 있는
        것" 에만 허용되는데 DESIGN.md §6 이 그 목록에 `드래그 중인 항목` 을 명시한다.**
        배경(`bg-bg`)도 그때만 갖는다 — 떠 있는 행이 아래 행을 가려야 한다. `relative z-10`
        (§7 z 스케일 "드래그 중인 일정 행") 이 없으면 그림자가 아래 행에 가린다.

        **살짝 키우는 것은 `motion-safe` 에서만** 한다 — 변형을 줄여 달라는 사람에게는 그림자만
        남긴다. 전환 시간은 §8 의 변형 값(200ms ease-out)이고, 감속 설정에서는 전역 규칙이
        한 프레임으로 줄인다.
      */
      className={cn(
        INSET_CLASS.card,
        'transition-[scale,box-shadow] duration-200 ease-out',
        dragging && 'bg-bg relative z-10 shadow-md motion-safe:scale-101',
        draggable && [
          /*
            길게 누르는 동안 글자 선택 · iOS 콜아웃이 뜨면 끌기가 그것으로 바뀐다. 카드 안의
            글자는 순서 편집에서 고르거나 복사할 대상이 아니다.
          */
          'select-none [-webkit-touch-callout:none]',
          /*
            **끌기 전에는 세로 스크롤을 브라우저에 넘긴다** (`pan-y`) — 카드가 화면 대부분을
            덮으므로 막으면 목록 위에서 화면을 올릴 수 없다. 끌기가 시작된 터치의 스크롤은
            `touch-action` 이 아니라 `useDragReorder` 의 `touchmove` 리스너가 막는다 —
            브라우저는 손가락이 닿는 순간의 값만 읽는다. `none` 은 그 뒤의 새 터치를 위해 건다.

            **두 손가락 확대는 남긴다** (`pinch-zoom`, #1029 검토). `pan-y` 만 두면 카드가 화면
            대부분을 덮어 목록 위에서 확대가 막힌다 — 저시력 사용자에게 회귀다. 두 번째 손가락은
            `onPointerDown` 이 받지 않으므로 끌기와 부딪히지 않는다.
          */
          dragging ? 'cursor-grabbing touch-none' : 'cursor-grab touch-pan-y touch-pinch-zoom',
        ],
      )}
      onPointerDown={draggable ? (event) => onDragPointerDown(index, event) : undefined}
      onContextMenu={onDragContextMenu}
    >
      <div ref={rowRef} className="flex items-center gap-3 py-2">
        {/* 순번은 `<ol>` 이 이미 읽는다 — 화면에만 보이는 표시다 */}
        <span
          aria-hidden
          className="bg-band text-fg-muted text-caption flex w-6 shrink-0 items-center justify-center self-stretch rounded-sm font-bold tabular-nums"
        >
          {index + 1}
        </span>

        {/*
          **시각 입력이 여기 있었다** (#623 → #1028 에서 걷음 · 명세 G0). 시각은 이제 일정
          목록의 칩이 고친다 — 계획적인 사용자만 넣으면 되는 값을 순서 편집 행마다 44px
          입력으로 세워 두니, 순서를 바꾸러 들어온 사람에게 행이 두 배로 무거웠다. 저장은
          서버가 준 원문을 그대로 되싣는다 (`planDayItemsPayload`).
        */}
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

        {/*
          **이동 버튼은 `md` 아이콘 버튼(44×44)이다** (#1427). `sm` 은 보이는 32 를 두고 누르는
          띠를 **세로로만** 넓혀(`SM_HIT_AREA`) 가로는 32 그대로였다 — DESIGN.md §7 의 44 에 못
          미쳤고, 버튼 사이 4px 틈 · 옆 몇 px 를 누르면 그 누름은 카드가 받아 **아무 일도 없이**
          끝났다(카드의 마우스 누름은 움직이지 않으면 끌기도 클릭도 아니다). 간헐적으로 "눌러도
          반응이 없다" 의 원인이다. 끌기 센서가 버튼 누름을 가로채는 것은 아니다 — 버튼에서 시작한
          누름은 `isInteractiveOrigin` 이 이미 끌기에서 뺀다 (`lib/plan/drag-gesture.ts`).

          **이름에 장소명을 넣는다.** `위로 이동` 만으로는 행마다 같은 이름이라 어느 장소의
          버튼인지 알 수 없다. 삭제 · 복구도 같은 문제라 함께 붙인다 — 보이는 글자는 그대로다.

          **삭제 · 복구도 `md`(높이 44)다** (#1470). `sm` 은 50×32 로 보이고 누르는 띠만 세로로
          넓혀 가로는 그대로였다 — 이동 버튼이 그 32 시절 테두리 · 틈 누름을 놓쳤던 것(#1463)과 같은
          위험이다. 보이는 크기를 키워 같은 행의 이동 버튼과 높이를 맞춘다: 누르는 자리만 넓히면
          옆 이동 버튼의 히트 영역과 겹친다.
        */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            ref={upRef}
            variant="ghost"
            size="md"
            iconOnly
            aria-label={messages.plan.editMoveUp.replace('{title}', () => entry.item.title)}
            disabled={first}
            leading={<ChevronDownIcon size={18} className="rotate-180" />}
            onKeyDown={handleKeyDown}
            onClick={() => onMove(index, 'up')}
          />
          <Button
            ref={downRef}
            variant="ghost"
            size="md"
            iconOnly
            aria-label={messages.plan.editMoveDown.replace('{title}', () => entry.item.title)}
            disabled={bottom}
            leading={<ChevronDownIcon size={18} />}
            onKeyDown={handleKeyDown}
            onClick={() => onMove(index, 'down')}
          />
          <Button
            variant="secondary"
            size="md"
            aria-label={(entry.removed
              ? messages.plan.editRestoreLabel
              : messages.plan.editRemoveLabel
            ).replace('{title}', () => entry.item.title)}
            onClick={() => onToggleRemoved(index)}
          >
            {entry.removed ? messages.plan.editRestore : messages.plan.editRemove}
          </Button>
        </div>
      </div>
    </li>
  )
}
