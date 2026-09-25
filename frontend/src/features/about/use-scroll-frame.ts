'use client'

import { useEffect, useRef } from 'react'

/**
 * 스크롤 · 리사이즈마다 **한 프레임에 한 번** `onFrame` 을 부른다 (#915, 명세 2026-09-25 §4).
 * 마운트 때 한 번 먼저 부른다.
 *
 * passive `scroll` + `requestAnimationFrame` 이다 — 스크롤 무대(`use-active-step.ts`)가
 * `IntersectionObserver` 사건으로는 빠른 스크롤의 위치를 놓쳐 이 방식으로 옮긴 것과 같은
 * 이유로, 소개 페이지의 스크롤 연동(패럴랙스 · 진행선 · 절 내비 · 스크롤 힌트)은 전부 이
 * 훅 하나로 잰다.
 *
 * **`onFrame` 은 ref 로 붙잡는다.** 매 렌더 새 함수가 와도 리스너를 다시 걸지 않는다.
 * 소비자는 가능하면 상태 대신 ref 로 DOM 스타일을 직접 고친다 — 스크롤 한 프레임마다
 * 다시 그리지 않게.
 */
export function useScrollFrame(onFrame: () => void): void {
  const callback = useRef(onFrame)

  useEffect(() => {
    callback.current = onFrame
  })

  useEffect(() => {
    let frame = 0
    const run = () => {
      frame = 0
      callback.current()
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(run)
    }

    callback.current()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [])
}

/** 감속 모션 여부 — 패럴랙스처럼 JS 가 직접 움직이는 것은 전역 CSS 규칙이 못 덮는다 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
