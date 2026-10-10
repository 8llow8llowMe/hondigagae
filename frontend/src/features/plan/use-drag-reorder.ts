'use client'

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { autoScrollStep } from '@/lib/plan/auto-scroll'
import type { MoveDirection } from '@/lib/plan/day-items'
import {
  advanceDragGesture,
  beginDragGesture,
  type DragGesture,
  type DragGestureEvent,
  type ElementLike,
  isInteractiveOrigin,
  TOUCH_HOLD_MS,
} from '@/lib/plan/drag-gesture'

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
 * **카드 전체가 손잡이다** (#1029). 번호만 잡던 때는 누르는 즉시 끌기였지만, 카드를 잡게 하면
 * 같은 누름이 클릭·스크롤·끌기 중 무엇인지 가려야 한다 — 마우스는 몇 px 움직여야, 터치는
 * 0.3초 길게 눌러야 끌기다. 그 판정은 `lib/plan/drag-gesture.ts` 의 순수 함수다.
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
  /** 끄는 중인 항목의 **현재 위치**. 끌기가 시작되기 전(대기 중)에도 `null` 이다 */
  const [dragging, setDragging] = useState<number | null>(null)
  const rowsRef = useRef<(HTMLElement | null)[]>([])

  /**
   * 누름 하나의 전부. 대기(`pending`)든 끌기(`active`)든 여기 있다.
   *
   * **state 가 아니라 ref 다.** 포인터 이벤트는 초당 수십 번 오고, 대기 중의 움직임은 화면을
   * 바꾸지 않는다 — 화면이 바뀌는 순간(끌기 시작 · 한 칸 이동 · 끝)만 `dragging` 으로 알린다.
   */
  const sessionRef = useRef<{
    gesture: DragGesture
    /** 끄는 항목의 현재 위치 */
    index: number
    /** 포인터 캡처를 걸 카드 */
    card: HTMLElement
    /** 누름을 끝낼 때 부른다 — 타이머·창 리스너·캡처를 한 자리에서 거둔다 */
    teardown: () => void
  } | null>(null)

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

  /**
   * 포인터 세로 좌표 하나로 목표 위치를 정하고 그만큼 한 칸 이동을 반복한다.
   *
   * **`pointermove` 와 자동 스크롤 프레임이 함께 부른다** — 둘이 같은 판정을 써야
   * 손을 움직일 때와 화면이 흐를 때의 결과가 갈리지 않는다.
   */
  const applyMove = useCallback(
    (y: number) => {
      const session = sessionRef.current
      if (session === null || session.gesture.phase !== 'active') return

      const here = session.index

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

      session.index = target
      setDragging(target)
    },
    [onMove],
  )

  /** 창 리스너·타이머가 최신 판정을 보게 한다 — 누름 도중에 `onMove` 가 바뀌어도 낡지 않는다 */
  const applyMoveRef = useRef(applyMove)
  applyMoveRef.current = applyMove

  /**
   * 누름의 상태를 한 걸음 옮긴다. **포인터 이벤트와 길게 누르기 타이머가 같은 길을 지난다.**
   */
  const advance = useCallback((event: DragGestureEvent) => {
    const session = sessionRef.current
    if (session === null) return

    const next = advanceDragGesture(session.gesture, event)
    if (next === null) {
      // 놓았거나, 길게 누르기 전에 움직여 스크롤로 판정됐다
      session.teardown()
      return
    }

    const started = session.gesture.phase === 'pending' && next.phase === 'active'
    session.gesture = next
    if (!started) return

    /*
      포인터 캡처가 있어야 **카드 밖으로 나가도** 이동·놓기가 계속 이 카드로 온다. 실제
      이동·놓기는 창 리스너가 받으므로 캡처가 없어도 드래그는 성립한다 — 이미 놓인 포인터
      id 로 부르면 `NotFoundError` 가 나는데, 그것 때문에 순서 바꾸기가 죽을 이유는 없다.
    */
    try {
      session.card.setPointerCapture(next.pointerId)
    } catch {
      // 캡처 없이 진행한다
    }
    // 끌기가 시작되는 순간 잡혀 있던 글자 선택을 걷는다 — 들린 카드 위에 파란 띠가 남는다
    window.getSelection()?.removeAllRanges()
    setDragging(session.index)
  }, [])

  /** 창 리스너·타이머는 누를 때 한 번 걸린다 — 그 사이 판정이 바뀌어도 최신 것을 부르게 한다 */
  const advanceRef = useRef(advance)
  advanceRef.current = advance

  const onPointerDown = useCallback((index: number, event: ReactPointerEvent<HTMLElement>) => {
    // 두 번째 손가락은 받지 않는다 — 한 번에 한 카드만 끈다
    if (sessionRef.current !== null) return

    // `삭제` · ▲▼ 를 누르다 손이 흔들렸다고 카드가 딸려 오면 버튼을 누를 수 없다
    if (isInteractiveOrigin(ancestorsUntil(event.target, event.currentTarget))) return

    const gesture = beginDragGesture({
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      ctrlKey: event.ctrlKey,
    })
    if (gesture === null) return

    /*
      **`preventDefault` 를 부르지 않는다** — 번호 손잡이 때와 다른 점이다. 터치의
      `pointerdown` 을 막으면 길게 누르기 전의 스크롤까지 죽는다. 글자 선택은 카드의
      `select-none` 이, 스크롤은 끌기가 시작된 뒤에만 `touchmove` 리스너가 막는다.
    */
    const card = event.currentTarget
    const pointerId = event.pointerId
    pointerYRef.current = event.clientY

    /*
      **이동·놓기는 창에서 받는다.** 카드에 걸면 한 칸 옮길 때 React 가 노드를 옮기면서
      포인터 캡처가 풀릴 수 있고, 그러면 그 뒤의 `pointerup` 이 다른 행이나 목록 밖으로 가
      끌기가 끝나지 않은 채 남는다. 창은 어디서 놓아도 받는다.
    */
    function handleMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return
      pointerYRef.current = moveEvent.clientY
      advanceRef.current({
        type: 'move',
        x: moveEvent.clientX,
        y: moveEvent.clientY,
        buttons: moveEvent.buttons,
      })
      applyMoveRef.current(moveEvent.clientY)
    }
    function handleEnd(endEvent: PointerEvent) {
      if (endEvent.pointerId !== pointerId) return
      advanceRef.current({ type: 'end' })
    }
    /*
      **화면이 가려지면 끝낸다** (#1029 검토). 앱 전환·OS 알림으로 `pointerup` · `pointercancel`
      이 오지 않으면 세션이 남고, 터치 대기 중이었다면 0.3초 타이머가 보이지 않는 화면에서
      끌기를 시작한다. 마우스의 놓친 놓기는 `buttons === 0` 이 따로 잡는다 (`advanceDragGesture`).
    */
    function handleHidden() {
      if (document.visibilityState === 'hidden') advanceRef.current({ type: 'end' })
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    document.addEventListener('visibilitychange', handleHidden)

    // 마우스에는 타이머가 없다 — `advanceDragGesture` 가 `hold` 를 무시하지만 걸 이유도 없다
    const timer =
      gesture.input === 'touch'
        ? window.setTimeout(() => advanceRef.current({ type: 'hold' }), TOUCH_HOLD_MS)
        : null

    sessionRef.current = {
      gesture,
      index,
      card,
      teardown: () => {
        if (timer !== null) window.clearTimeout(timer)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleEnd)
        window.removeEventListener('pointercancel', handleEnd)
        document.removeEventListener('visibilitychange', handleHidden)
        if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId)
        sessionRef.current = null
        setDragging(null)
      },
    }
  }, [])

  /**
   * 길게 누르는 동안 뜨는 메뉴를 막는다. **누름이 진행 중일 때만** — 그 밖의 오른쪽 클릭은
   * 브라우저 메뉴를 그대로 연다. Android Chrome 은 길게 누르기에 `contextmenu` 를 보낸다.
   */
  const onContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (sessionRef.current !== null) event.preventDefault()
  }, [])

  /**
   * 끌기가 시작된 뒤의 화면 스크롤을 막는다.
   *
   * **`touch-action` 만으로는 안 된다.** 브라우저는 `touch-action` 을 **손가락이 닿는 순간**
   * 읽는다 — 길게 누르기 전에는 스크롤이 돼야 하므로 그때 값은 `pan-y` 이고, 끌기가 시작된
   * 뒤 `none` 으로 바꿔도 이미 시작된 터치에는 먹지 않는다. 남는 수단은 `touchmove` 의
   * `preventDefault` 다.
   *
   * **목록에 늘 걸어 두는 non-passive 리스너다.** React 의 `onTouchMove` 는 passive 라
   * `preventDefault` 가 무시되고, 끌기가 시작될 때 붙이면 늦다 — Chrome 은 손가락이 닿는
   * 순간 그 자리에 막을 수 있는 리스너가 있는지 보고, 없으면 그 터치 전체를 스크롤 스레드가
   * 혼자 처리한다. 대기 중에는 아무것도 막지 않으므로 스크롤은 그대로 된다.
   */
  const registerList = useCallback((node: HTMLElement | null) => {
    if (node === null) return

    function blockScrollWhileDragging(event: TouchEvent) {
      if (sessionRef.current?.gesture.phase === 'active' && event.cancelable) {
        event.preventDefault()
      }
    }

    node.addEventListener('touchmove', blockScrollWhileDragging, { passive: false })
    return () => node.removeEventListener('touchmove', blockScrollWhileDragging)
  }, [])

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

  /*
    **누르는 도중 편집이 닫혀도 창 리스너·타이머가 남지 않게 한다** (`done-checklist.md` §3).
    저장이 끝나 편집이 언마운트되는 것은 손을 떼기 전에도 일어날 수 있다.
  */
  useEffect(() => () => sessionRef.current?.teardown(), [])

  return { dragging, registerRow, registerList, onPointerDown, onContextMenu }
}

/**
 * 누른 요소부터 카드 **바로 안쪽**까지의 조상. 카드 자신은 넣지 않는다 — 카드는 `li` 라
 * 대화형이 아니지만, 판정 대상이 "카드 안의 무엇을 눌렀나" 이므로 경계를 분명히 둔다.
 */
function ancestorsUntil(target: EventTarget, boundary: Element): ElementLike[] {
  const chain: ElementLike[] = []
  let node = target instanceof Element ? target : null
  while (node !== null && node !== boundary) {
    chain.push(node)
    node = node.parentElement
  }
  return chain
}

/** 행이 화면에서 차지하는 세로 구간의 중간선 */
function centerOf(row: HTMLElement): number {
  const rect = row.getBoundingClientRect()
  return rect.top + rect.height / 2
}
