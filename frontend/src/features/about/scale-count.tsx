'use client'

import { useRef } from 'react'

import { useCountUp } from '@/features/about/use-count-up'
import { useRevealOnce } from '@/features/about/use-reveal-once'

/**
 * 데이터 절 규모 숫자 (#915, 명세 2026-09-25 §4) — 화면에 들어올 때 600ms 로 한 번 센다.
 *
 * 히어로 판정 카드와 같은 계약이다: **최종값은 처음부터 `sr-only` 로 DOM 에 있고**, 세는
 * 중간값은 `aria-hidden` 인 시각 노드에만 있다. 로드 때 이미 보이는 타일은 세지 않는다
 * (`useRevealOnce(…, false)`). 정적 렌더의 시각 노드도 최종값이다.
 *
 * **셀 준비 중(`armed`)에는 0 을 보인다.** 타일의 등장(`Reveal`)은 타일 윗변이, 세기는 숫자가
 * 선을 지날 때 시작해 그 사이 약 17px 동안 타일은 보이는데 숫자는 이미 끝 값이었다 — 멈추면
 * 315 가 보이다가 더 내리면 44 로 떨어져 다시 셌다(#915 검토, 브라우저 재현). 시작 값 0 을
 * 먼저 보이면 세기가 그 자리에서 이어진다.
 */
export function ScaleCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const phase = useRevealOnce(ref, false)
  const shown = useCountUp(value, phase === 'revealed')

  return (
    <span ref={ref}>
      <span className="sr-only">{value}</span>
      <span aria-hidden>{phase === 'armed' ? 0 : Math.round(shown)}</span>
    </span>
  )
}
