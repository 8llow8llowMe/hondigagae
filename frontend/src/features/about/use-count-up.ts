'use client'

import { useEffect, useState } from 'react'

const COUNT_UP_MS = 600

/**
 * 0 → target 카운트업 (#635, 명세 §6-4). `play` 가 참이 되는 순간 시작하고 600ms 뒤 **반드시
 * 끝 값으로 고정**한다 — 브라우저 패널이 숨겨지면 rAF 가 멈춰 중간값에 머무는 함정이 있다.
 * `prefers-reduced-motion` 이면 즉시 끝 값 — JS 가 그리는 값이라 전역 CSS 규칙이 못 덮는다.
 * 처음 값은 **target 이다** (정적 렌더 = 끝 상태).
 *
 * 히어로 판정 카드(#635)와 데이터 절 규모 숫자(#915)가 함께 쓴다. 값은 소수 첫째 자리까지
 * 나오므로 정수로 보일 곳은 호출부가 반올림한다.
 */
export function useCountUp(target: number, play: boolean): number {
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (!play) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(target * eased * 10) / 10)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    setValue(0)
    frame = requestAnimationFrame(tick)
    const settle = window.setTimeout(() => setValue(target), COUNT_UP_MS + 50)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settle)
    }
  }, [target, play])

  return value
}
