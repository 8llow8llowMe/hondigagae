'use client'

import { useEffect } from 'react'

/**
 * 스크롤바를 **구르는 동안에만** 드러낸다 — 이슈 #553.
 *
 * 모양은 `app/globals.css` 가 갖는다(`::-webkit-scrollbar-thumb` 가 기본 투명, 여기서
 * 붙이는 `[data-scrolling]` 이 색을 준다). 이 컴포넌트는 **언제 붙이고 떼는가**만 안다.
 *
 * **`scroll` 은 버블하지 않는다.** 그래서 캡처 단계에서 `document` 한 곳만 듣는다 —
 * 스크롤 컨테이너마다 리스너를 달면 필터 레일·목록 열·가로 칩 줄까지 화면마다 개수가
 * 달라지고, 나중에 생기는 컨테이너(모달·바텀시트)는 아무도 달아 주지 않는다.
 *
 * **뷰포트 스크롤은 `body` 에 표시한다.** 이벤트 `target` 은 `document` 로 오지만,
 * 뷰포트 스크롤바의 의사요소를 잡는 것은 `body::` 뿐이다 (`globals.css` 의 탭바 트랙
 * 규칙이 같은 실측으로 적어 둔 것이다). `documentElement` 에 붙이면 아무 일도 안 난다.
 *
 * **`passive: true` 다.** 아무것도 막지 않으므로 브라우저가 스크롤을 기다리지 않는다.
 *
 * **떼는 것은 요소마다 따로 센다.** 목록을 굴리다 레일로 옮겨 가면 두 컨테이너가 잠깐
 * 겹치는데, 타이머가 하나뿐이면 먼저 멈춘 쪽이 나중 쪽의 표시를 지운다.
 */
const HIDE_DELAY_MS = 900

export function ScrollbarReveal() {
  useEffect(() => {
    /*
      `WeakMap` 이라 사라진 요소의 타이머 항목이 함께 사라진다 — 라우트를 옮기며
      스크롤 컨테이너가 계속 바뀌는 화면에서 `Map` 은 계속 자란다.
    */
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>()
    /** 정리할 때 남은 타이머를 전부 끄려면 별도로 들고 있어야 한다 — `WeakMap` 은 못 돈다 */
    const pending = new Set<Element>()

    function handleScroll(event: Event) {
      const target = event.target
      // 뷰포트 스크롤(`target === document`)은 `body` 가 받는다
      const element =
        target instanceof Element ? target : target === document ? document.body : null
      if (element === null) return

      element.setAttribute('data-scrolling', '')
      pending.add(element)

      const running = timers.get(element)
      if (running !== undefined) clearTimeout(running)

      timers.set(
        element,
        setTimeout(() => {
          element.removeAttribute('data-scrolling')
          timers.delete(element)
          pending.delete(element)
        }, HIDE_DELAY_MS),
      )
    }

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true })
      for (const element of pending) {
        const running = timers.get(element)
        if (running !== undefined) clearTimeout(running)
        element.removeAttribute('data-scrolling')
      }
      pending.clear()
    }
  }, [])

  return null
}
