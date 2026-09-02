'use client'

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react'

import type { MoveDirection } from '@/lib/plan/day-items'

/**
 * 잡아서 끌어 순서 바꾸기 — 포인터 이벤트로 직접 구현한다.
 *
 * **드래그 라이브러리를 넣지 않았다.** 예전 주석("의존성 하나를 이 화면 하나로 들이지
 * 않는다")의 판단은 유효하고, 여기서 필요한 것은 라이브러리가 주는 것의 일부다 —
 * 세로 한 줄 목록, 항목 몇 개, 애니메이션 없음.
 *
 * **HTML5 drag-and-drop(`draggable`)이 아니라 Pointer Events 다.** `dragstart` 계열은
 * 터치에서 아예 발생하지 않아 모바일에서 기능이 사라진다. 이 앱은 모바일이 먼저다.
 *
 * **한 칸 스왑을 반복한다.** 끌면서 이웃 행의 중간선을 넘을 때마다 기존
 * `move(index, direction)` 을 한 번 부른다. 그래서
 *  - 배열 조작 규칙이 버튼·키보드와 **완전히 같은 코드**를 지난다 (`moveEditItem`)
 *  - 목록이 끄는 동안 실제로 재배열돼, 손을 떼기 전에 결과가 보인다
 *  - `transform` 으로 가짜 미리보기를 그리고 놓을 때 진짜 배열을 고치는 이중 상태가 없다
 *
 * 좌표 기준은 **끄는 손가락의 위치와 이웃 행의 중간선**이다. 행 높이가 서로 달라
 * (삭제 표시·경고 문구가 붙은 행이 더 높다) 고정 높이로 계산할 수 없으므로 매번
 * `getBoundingClientRect()` 로 읽는다.
 */
export function useDragReorder({
  onMove,
}: {
  /** 한 칸 이동. 드래그 중에는 포커스를 옮기지 않는다 (`moveFocus: false`) */
  onMove: (index: number, direction: MoveDirection, moveFocus: boolean) => void
}) {
  /** 끄는 중인 항목의 **현재 위치**. 없으면 `null` */
  const [dragging, setDragging] = useState<number | null>(null)
  const rowsRef = useRef<(HTMLElement | null)[]>([])
  const activeRef = useRef<{ pointerId: number; index: number } | null>(null)

  /** 행 엘리먼트를 위치별로 기억한다 — 중간선을 재려면 실제 노드가 필요하다 */
  const registerRow = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      rowsRef.current[index] = node
    },
    [],
  )

  const onPointerDown = useCallback((index: number, event: ReactPointerEvent<HTMLElement>) => {
    // 왼쪽 버튼·터치·펜만. 오른쪽 클릭으로 드래그가 시작되면 컨텍스트 메뉴와 엉킨다
    if (event.button !== 0) return

    // 텍스트 선택과 터치 스크롤을 막는다. 손잡이에 `touch-action: none` 도 함께 건다
    event.preventDefault()
    /*
      포인터 캡처가 있어야 **손잡이 밖으로 나가도** 이동·놓기가 계속 이 요소로 온다.
      실패해도 드래그 자체는 성립해야 한다 — 이미 놓인 포인터 id 로 부르면
      `NotFoundError` 가 나는데, 그것 때문에 순서 바꾸기가 죽을 이유는 없다.
    */
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 캡처 없이 진행한다
    }
    activeRef.current = { pointerId: event.pointerId, index }
    setDragging(index)
  }, [])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const active = activeRef.current
      if (active === null || event.pointerId !== active.pointerId) return

      const y = event.clientY
      const here = active.index

      /*
        **목표 위치를 먼저 정하고, 한 칸 이동을 그만큼 반복한다.**

        한 이벤트에 한 칸만 옮기면 빠르게 끌 때 항목이 손을 못 따라온다 (실측: 세 칸
        거리를 한 번에 끌면 한 칸만 움직였다). 포인터 이벤트는 손의 속도에 따라
        띄엄띄엄 오므로 "이벤트 한 번 = 한 칸" 은 성립하지 않는다.

        여러 칸을 한 번에 계산할 수 있는 근거: **i 와 i+1 을 맞바꿔도 i+2 이후 행의
        위치는 변하지 않는다.** 두 행이 차지하는 세로 구간의 합이 그대로이기 때문이다.
        그래서 지금 읽은 사각형으로 아래·위를 계속 훑어도 좌표가 낡지 않는다.
      */
      let target = here
      for (;;) {
        const below = rowsRef.current[target + 1]
        if (below === null || below === undefined || y <= centerOf(below)) break
        target += 1
      }
      for (;;) {
        const above = rowsRef.current[target - 1]
        if (above === null || above === undefined || y >= centerOf(above)) break
        target -= 1
      }

      if (target === here) return

      // 한 칸씩 부른다 — 배열 조작은 버튼·키보드와 같은 `moveEditItem` 하나만 지난다
      const direction = target > here ? 'down' : 'up'
      const step = target > here ? 1 : -1
      for (let index = here; index !== target; index += step) {
        onMove(index, direction, false)
      }

      active.index = target
      setDragging(target)
    },
    [onMove],
  )

  const onPointerEnd = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = activeRef.current
    if (active === null || event.pointerId !== active.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activeRef.current = null
    setDragging(null)
  }, [])

  return { dragging, registerRow, onPointerDown, onPointerMove, onPointerEnd }
}

/** 행이 화면에서 차지하는 세로 구간의 중간선 */
function centerOf(row: HTMLElement): number {
  const rect = row.getBoundingClientRect()
  return rect.top + rect.height / 2
}
