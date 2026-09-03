'use client'

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { autoScrollStep } from '@/lib/plan/auto-scroll'
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
 *
 * **가장자리에서 화면이 따라 스크롤한다** (#161). 목록이 화면보다 길면 1번을 8번 자리로
 * 옮기려다 손이 화면 밖으로 나가 버렸다 — 놓고, 스크롤하고, 다시 잡아야 했다.
 * 판정 규칙은 `lib/plan/auto-scroll.ts` 에 순수 함수로 빼 두었다.
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

  /**
   * 마지막 포인터 세로 좌표 (#161).
   *
   * **자동 스크롤 프레임이 이 값을 다시 읽는다.** 손가락이 멈춰 있어도 화면이 흐르면
   * 행의 중간선이 움직이므로 판정이 계속 돌아야 한다 — `pointermove` 만 보면 손을
   * 가장자리에 대고 가만히 있을 때 스크롤만 되고 순서는 안 바뀐다.
   */
  const pointerYRef = useRef(0)

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
    // 첫 프레임이 낡은 좌표로 스크롤하지 않도록 시작점을 먼저 채운다
    pointerYRef.current = event.clientY
    setDragging(index)
  }, [])

  /**
   * 포인터 세로 좌표 하나로 목표 위치를 정하고 그만큼 한 칸 이동을 반복한다.
   *
   * **`pointermove` 와 자동 스크롤 프레임이 함께 부른다** — 둘이 같은 판정을 써야
   * 손을 움직일 때와 화면이 흐를 때의 결과가 갈리지 않는다.
   */
  const applyMove = useCallback(
    (y: number) => {
      const active = activeRef.current
      if (active === null) return

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

  /** 프레임 루프가 최신 판정을 보게 한다 — deps 에 넣으면 재배열마다 루프가 끊긴다 */
  const applyMoveRef = useRef(applyMove)
  applyMoveRef.current = applyMove

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const active = activeRef.current
      if (active === null || event.pointerId !== active.pointerId) return

      pointerYRef.current = event.clientY
      applyMove(event.clientY)
    },
    [applyMove],
  )

  /*
    자동 스크롤 루프 (#161).

    **`dragging` 이 아니라 끄는 중인지 여부에만 반응한다.** `dragging` 은 한 칸 옮길
    때마다 바뀌어서, 그것을 deps 에 넣으면 스왑이 일어날 때마다 루프가 끊겼다 다시 선다.

    **cleanup 이 프레임을 반드시 취소한다** (`done-checklist.md` §3). 손을 떼든,
    드래그가 취소되든, 화면을 벗어나든 같은 자리로 모인다 — `onPointerEnd` 에만 걸면
    편집이 언마운트될 때 루프가 남는다.
  */
  const isDragging = dragging !== null

  useEffect(() => {
    if (!isDragging) return

    let frame = requestAnimationFrame(function tick() {
      const step = autoScrollStep(pointerYRef.current, window.innerHeight)
      if (step !== 0) {
        window.scrollBy(0, step)
        // 화면이 움직였으니 중간선도 움직였다 — 손이 멈춰 있어도 다시 판정한다
        applyMoveRef.current(pointerYRef.current)
      }
      frame = requestAnimationFrame(tick)
    })

    return () => cancelAnimationFrame(frame)
  }, [isDragging])

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
