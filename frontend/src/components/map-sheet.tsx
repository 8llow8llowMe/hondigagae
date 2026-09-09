'use client'

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useState,
} from 'react'

import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * MapSheet — 지도 위 하단 시트 3단.
 *
 * 아트보드 `혼디가개 장소 찾기` 06절. **`BottomSheet` 와 다른 컴포넌트다.**
 * 저쪽은 모달(배경 덮개 + `aria-modal` + Esc 로 닫힘)이라 지도를 가리고 제스처를
 * 막는다. 여기는 반대여야 한다:
 *
 *  - **배경 덮개가 없다.** 시트가 열려 있어도 지도 이동·확대가 계속 먹는다
 *  - **모달이 아니다.** 포커스를 가두지 않는다 — 지도와 시트를 오가야 한다
 *  - 단계는 **최소 / 중간 / 최대** 3단이고 손을 떼면 가장 가까운 단계로 붙는다(스냅)
 *  - **최소 단계에서만 탭바가 보인다.** 그 위 단계에서는 시트가 탭바 자리를 쓴다
 *
 * 드래그는 Pointer Events 하나로 처리한다 — 마우스·터치·펜이 같은 코드로 돌고,
 * `setPointerCapture` 가 손가락이 시트 밖으로 나가도 추적을 유지한다.
 */

export const SHEET_STOPS = ['min', 'mid', 'max'] as const
export type SheetStop = (typeof SHEET_STOPS)[number]

/** 뷰포트 높이 대비 비율. 최대는 검색 헤더가 보이도록 85% 에서 멈춘다 */
const STOP_RATIO: Record<SheetStop, number> = { min: 0.2, mid: 0.45, max: 0.85 }

/** 이보다 적게 끌면 단계를 바꾸지 않는다 — 스크롤하려다 단계가 바뀌면 목록을 못 읽는다 */
const DRAG_THRESHOLD_PX = 24

export function MapSheet({
  label,
  stop,
  onStopChange,
  toolbar,
  header,
  children,
  className,
  maxTopInset = 0,
}: {
  /**
   * 시트의 접근성 이름. **화면마다 다르다** — 장소 찾기는 "장소 목록", 긴급 시설은
   * "병원 · 약국 목록" 이다. 문구를 이 컴포넌트가 들고 있던 시절에는 병원 목록이
   * "장소 목록" 으로 읽혔다.
   */
  label: string
  stop: SheetStop
  onStopChange: (stop: SheetStop) => void
  /**
   * 전폭 컨트롤 줄 — 필터가 여기 온다. **`header` 와 한 줄에 두지 않는다.**
   * 단계 이동 버튼과 나란히 두면 375 에서 폭이 300 도 안 남아 필터 칩이 두 개만 보였다.
   */
  toolbar?: ReactNode
  /** 항상 보이는 줄 — 개수와 정렬. 최소 단계에서도 남는다 */
  header: ReactNode
  children: ReactNode
  className?: string
  /**
   * `max` 단계에서 **비워 둘 상단 높이**(px). 기본 `0` 이면 지금까지처럼 `85dvh` 다.
   *
   * **비율이 아니라 px 로 받는다.** `STOP_RATIO.max`(0.85dvh)는 상단 컨트롤이
   * `absolute` 로 떠 있는 `/places` 기준으로 튜닝된 값이라, 헤더가 **정상 흐름**인
   * 화면에서는 헤더를 덮는다 — 375×812 실측으로 시트 상단이 y=122 인데 담기 화면
   * 헤더는 y=56~189 를 쓴다(제목·보기 전환·부제가 전부 가려지고 지도 가시 영역이 0).
   *
   * 그리고 비율은 **기기가 작을수록 더 덮는다**: 667px 기기라면 `85dvh` 의 상단이
   * y=100 으로 내려가 지금보다 나빠진다. 헤더 높이는 기기 높이와 무관하게 거의
   * 일정하므로 px 이 안정적이다.
   */
  maxTopInset?: number | undefined
}) {
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    setDragOffset(0)
  }, [])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      // 위로 끌면 음수 → 시트가 커진다
      setDragOffset(event.movementY + dragOffset)
    },
    [dragging, dragOffset],
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.releasePointerCapture(event.pointerId)
      setDragging(false)
      onStopChange(nextStop(stop, dragOffset))
      setDragOffset(0)
    },
    [stop, dragOffset, onStopChange],
  )

  /*
    끄는 동안의 오프셋은 두 갈래 모두 같은 방식으로 빼진다 — 위로 끌면 음수라 커진다.
    `maxTopInset` 은 **`max` 에만** 걸린다. `min`·`mid` 는 헤더와 부딪히지 않으므로
    비율 그대로 두는 편이 화면 크기에 잘 따라간다.
  */
  const base =
    stop === 'max' && maxTopInset > 0
      ? `100dvh - ${String(maxTopInset)}px`
      : `${String(STOP_RATIO[stop] * 100)}dvh`
  const height = `calc(${base} - ${String(Math.round(dragOffset))}px)`

  return (
    <section
      aria-label={label}
      style={{ height }}
      className={cn(
        // `develop` 의 DESIGN.md z-index 스케일: 모바일 탭바는 "흐름 내 컨트롤에 붙은
        // 팝오버" 층(z-40)이고, `BottomSheet`/`Modal`/`Toast` 는 그 위 "오버레이" 층(z-50)이다.
        // 이 시트도 z-40 을 썼던 시절에는 탭바와 같은 층이라 DOM 순서가 승패를 갈랐고,
        // 탭바가 나중에 그려져 시트의 하단 64px 을 덮었다(min 이 아닌 단계에서 시트가
        // `bottom-0` 을 쓰기 때문). z-50 으로 올려 이 컴포넌트 헤더 주석의 "그 위 단계에서는
        // 시트가 탭바 자리를 쓴다" 는 문장을 실제로 성립시킨다. `BottomSheet` 와 같은 층을
        // 쓰지만 이 시트는 배경 덮개·`aria-modal`·포커스 트랩이 전혀 없다 — 오직 쌓임 순서만
        // 그쪽과 같아졌을 뿐, 모달이 되지는 않는다.
        'bg-bg border-border fixed inset-x-0 z-50 flex flex-col rounded-t-xl border-t shadow-lg lg:hidden',
        // 최소 단계에서만 탭바가 보인다. 그 위에서는 시트가 탭바 자리를 쓴다
        stop === 'min' ? 'map-sheet-above-tabbar' : 'bottom-0',
        // 끄는 동안에는 전환을 끈다 — 손가락을 따라오지 못하고 끈적여 보인다
        !dragging && 'transition-[height] duration-200',
        className,
      )}
    >
      {/* 그래버 — 이것만 드래그를 받는다. 목록 전체가 드래그를 먹으면 스크롤이 안 된다 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
      >
        <span aria-hidden className="bg-border-strong h-1 w-9 rounded-full" />
      </div>

      {/* 필터 같은 전폭 컨트롤. 최소 단계에서도 남으므로 지도를 보면서 조건을 바꿀 수 있다 */}
      {toolbar !== undefined && <div className="px-3 pb-2">{toolbar}</div>}

      {/**
       * 드래그를 못 쓰는 입력(키보드·스위치)을 위한 단계 이동. 아이콘 없이 글자로 둔다 —
       * 드래그 힌트를 흉내 낸 버튼은 무엇을 하는지 읽히지 않는다
       */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2">
        <div className="min-w-0 flex-1">{header}</div>
        <button
          type="button"
          onClick={() => onStopChange(stop === 'max' ? 'min' : 'max')}
          className="text-caption text-fg-muted hover:text-fg focus-visible:ring-brand-500 shrink-0 rounded-md px-2 py-2 font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {stop === 'max' ? messages.map.collapseSheet : messages.map.expandSheet}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  )
}

/**
 * 끈 거리로 다음 단계를 고른다.
 *
 * **한 번에 한 단계씩만 움직인다.** 최소에서 크게 끌었다고 최대로 보내면 목록이
 * 갑자기 화면을 덮어 지도를 잃는다 — 카카오맵도 한 단계씩 붙는다.
 */
export function nextStop(current: SheetStop, dragOffset: number): SheetStop {
  if (Math.abs(dragOffset) < DRAG_THRESHOLD_PX) return current

  const index = SHEET_STOPS.indexOf(current)
  // 위로 끌면 음수다 → 한 단계 올린다
  const next = dragOffset < 0 ? index + 1 : index - 1

  return SHEET_STOPS[Math.min(SHEET_STOPS.length - 1, Math.max(0, next))] ?? current
}
