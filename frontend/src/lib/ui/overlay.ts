'use client'

import { type RefObject, useEffect } from 'react'

/** 초점을 받을 수 있는 것들. 첫 초점과 Tab 순환이 같은 목록을 본다 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * 로빙 tabindex 를 걷어낸 **실제 탭 정지** 목록.
 *
 * `Calendar` 의 날짜 격자는 격자 전체가 탭 정지 하나다 — 포커스를 든 칸만 `tabIndex 0` 이고
 * 나머지 수십 칸은 `-1` 이다. 그런데 셀렉터의 `button:not([disabled])` 는 그 `-1` 칸까지
 * 전부 집어 온다. 여기서 한 번 더 거르지 않으면 Tab 한 번이 옆 날짜로 가고, 패널을 한 바퀴
 * 도는 데 마흔 번이 걸린다.
 *
 * 이 저장소에는 jsdom 이 없어 DOM 을 세워 두고 검증할 수 없다. 그래서 `tabIndex` 만 보는
 * 순수 함수로 떼어 냈다 — 필터 조건 자체는 node 에서 확인된다.
 */
export function tabbableOf<T extends { tabIndex: number }>(elements: readonly T[]): T[] {
  return elements.filter((element) => element.tabIndex >= 0)
}

/**
 * Tab · Shift+Tab 이 갈 다음 자리. 목록 끝을 넘으면 반대편으로 감는다.
 *
 * `current` 가 `-1` 이면 **초점이 목록 밖**이라는 뜻이다 — 패널 자신(`tabIndex={-1}`)이
 * 초점을 들고 있는, 열자마자 흔히 생기는 상태다. 이때 Tab 은 처음으로, Shift+Tab 은
 * 끝으로 보낸다. 감기 계산에서 이 `-1` 이 가장 틀리기 쉬워서 함수로 떼어 두었다.
 */
export function nextFocusIndex(current: number, count: number, backward: boolean): number {
  if (backward) return current <= 0 ? count - 1 : current - 1
  return current === count - 1 ? 0 : current + 1
}

/**
 * 오버레이 공통 동작 — 디자인 가이드 §5-2 · §6.
 *
 * 세 가지를 함께 건다. 하나라도 빠지면 접근성 계약이 깨진다.
 * - Esc 로 닫고 **트리거로 포커스를 되돌린다**
 * - 열릴 때 컨테이너 안으로 포커스를 넣는다
 * - 바탕 스크롤을 잠근다
 *
 * 나머지 두 가지(`trapFocus` · `restoreFocusPreventScroll`)는 **옵트인이다.** 이 훅은
 * `Modal` · `BottomSheet` · `Menu` · `InfoTip` · `PhotoViewer` · `ProfileCard` ·
 * `PetSwitcher` 가 함께 쓰는 공용물이라, 기본값을 바꾸면 한 화면의 버그를 고치려다 일곱
 * 군데의 키보드 동작이 같이 움직인다. 필요한 곳만 켠다.
 */
export function useOverlay({
  open,
  onClose,
  containerRef,
  /** 닫을 때 포커스를 되돌릴 대상. 없으면 열기 직전의 활성 요소로 돌아간다 */
  triggerRef,
  initialFocusRef,
  /** 팝오버는 바탕 스크롤을 잠그지 않는다 — 배경 덮개가 없어 페이지가 살아 있다 */
  lockScroll = true,
  trapFocus = false,
  restoreFocusPreventScroll = false,
}: {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  triggerRef?: RefObject<HTMLElement | null>
  /**
   * 열릴 때 초점을 받을 요소. ConfirmModal 은 이것으로 **취소**를 잡는다 —
   * 파괴 버튼에 포커스가 가면 Enter 한 번에 되돌릴 수 없는 일이 일어난다.
   */
  initialFocusRef?: RefObject<HTMLElement | null>
  lockScroll?: boolean
  /**
   * Tab · Shift+Tab 을 컨테이너 안에서 순환시킨다. **기본은 끈다** — 흐름 안에 있는
   * 오버레이는 Tab 이 다음 요소로 자연스럽게 빠져나가는 것이 맞고, 지금 사용처들이 전부
   * 그렇게 쓰고 있다.
   *
   * 포털로 `body` 끝에 붙는 패널만 이것이 필요하다. 그런 패널에서 Tab 은 트리거 옆이 아니라
   * **문서 맨 끝**으로 나간다 — 달력을 열어 둔 채 페이지 전체를 훑게 되는 것이다
   * (ARIA APG 의 date picker dialog 가 트랩을 두는 이유이기도 하다).
   *
   * **`focusout` 으로 닫는 방식은 쓰지 않는다.** 코드는 더 짧지만 이 훅에서는 성립하지
   * 않는다 — 의존성이 바뀌면 cleanup 이 트리거로 포커스를 되돌리고 setup 이 다시 패널로
   * 넣는다. `DateField` 는 열리자마자 `setPosition` 으로 한 번 더 렌더되므로, `focusout`
   * 핸들러가 걸려 있으면 **열린 그 프레임에 닫힌다.**
   */
  trapFocus?: boolean
  /**
   * 닫을 때의 트리거 복귀를 `preventScroll` 로 한다. **기본은 끈다** — 화면 밖으로 나간
   * 트리거로 포커스가 돌아갈 때 보이는 자리까지 스크롤해 주는 것이 보통은 옳다.
   *
   * **스크롤을 닫는 조건으로 쓰는** 오버레이만 켠다. 그런 오버레이는 사용자가 트리거를
   * 화면 밖으로 밀어냈기 때문에 닫히는데, 그 직후 복귀 포커스가 트리거를 다시 화면 안으로
   * 끌어오면 방금 굴린 스크롤이 통째로 되감긴다. Esc · 날짜 선택처럼 트리거가 이미 화면에
   * 있는 경로에서는 켜도 달라지는 것이 없다.
   */
  restoreFocusPreventScroll?: boolean
}): void {
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // 첫 초점을 컨테이너 안으로. 초점 가능한 것이 없으면 컨테이너 자신이 받는다.
    const container = containerRef.current
    const focusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(initialFocusRef?.current ?? focusable ?? container)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    /*
      Tab 가두기. **document 가 아니라 컨테이너에 건다** — 키는 초점을 든 요소에서
      올라오므로, 이 핸들러가 불렸다는 것 자체가 "초점이 아직 패널 안" 이라는 뜻이다.
      바깥에서 누른 Tab 은 여기까지 오지 않아 페이지의 나머지는 그대로 둔다.

      목록은 매번 다시 읽는다. 달을 넘기면 격자가 통째로 갈리고 로빙 tabindex 도 옮겨
      다녀서, 열 때 한 번 담아 둔 목록은 곧 죽은 노드를 가리킨다.
    */
    function onTrapKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return

      const root = containerRef.current
      if (root === null) return

      const stops = tabbableOf(Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)))
      if (stops.length === 0) return

      const active = document.activeElement
      const current = active instanceof HTMLElement ? stops.indexOf(active) : -1
      const next = stops[nextFocusIndex(current, stops.length, event.shiftKey)]
      if (next === undefined) return

      event.preventDefault()
      next.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    if (trapFocus) container?.addEventListener('keydown', onTrapKeyDown)

    const previousOverflow = document.body.style.overflow
    if (lockScroll) document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (trapFocus) container?.removeEventListener('keydown', onTrapKeyDown)
      if (lockScroll) document.body.style.overflow = previousOverflow
      // 트리거 복귀. 이것이 없으면 닫은 뒤 포커스가 body 로 떨어진다.
      ;(triggerRef?.current ?? previouslyFocused)?.focus(
        restoreFocusPreventScroll ? { preventScroll: true } : undefined,
      )
    }
  }, [
    open,
    onClose,
    containerRef,
    triggerRef,
    initialFocusRef,
    lockScroll,
    trapFocus,
    restoreFocusPreventScroll,
  ])
}
