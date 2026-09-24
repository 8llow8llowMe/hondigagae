'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** 단계를 세는 기준선 — 뷰포트 세로 가운데 (명세 2026-09-25 §3-4) */
export const ACTIVE_STEP_LINE = 0.5

/**
 * 항목 윗변들 → 단계. **윗변이 기준선을 지난 마지막 항목의 번호**(1-based)다.
 *
 * - 기준선이 항목 사이 틈에 있으면 위 항목 · 무대를 지나왔으면 마지막 번호 · 아직 안 왔으면 0.
 * - `null`(등록되지 않은 항목)은 건너뛰되 **번호는 원래 자리 그대로 센다** — 걸러낸 뒤 다시
 *   세면 뒤 번호가 한 칸씩 당겨지고, 마지막 단계에만 드러나는 내용(특보 띠 · 진입 행)이
 *   `is-live` 아래에서 영영 숨는다.
 *
 * 순수 함수로 뗀 이유: 훅은 node 테스트 환경에서 돌릴 수 없어, 이 식이 틀려도(한 칸 어긋남 ·
 * 방향 뒤집힘 · 틈을 아래 항목으로 셈) 소스 가드는 전부 통과한다.
 */
export function stepAt(tops: readonly (number | null)[], line: number): number {
  let step = 0
  tops.forEach((top, index) => {
    if (top !== null && top <= line) step = index + 1
  })
  return step
}

/**
 * 스크롤 무대의 현재 단계 (#914, 명세 2026-09-25 §3).
 *
 * - **첫 렌더는 `count` 다.** 정적 렌더 · JS 실패 · 검색 봇이 전부 끝 상태(전부 보임)를 본다.
 *   마운트 때 한 번 재서 실제 위치로 맞춘다 — 아직 안 온 무대는 0 으로 되감기고, 지나온
 *   무대는 끝 상태로 남는다.
 * - **첫 맞춤은 전환 없이 적용한다**(`settling`). 화면 안에 걸린 무대가 로드 직후 끝 상태에서
 *   0 으로 되감길 때, 전환이 켜져 있으면 칩이 200ms 에 걸쳐 사라지는 "지우기" 가 재생된다.
 *   두 프레임 동안 `settling` 으로 전환을 끄고(`globals.css` `.is-settling`), 그 뒤부터 단계
 *   전환이 재생된다 — `useRevealOnce` 의 `armed` 와 같은 계약이다.
 * - **스크롤마다 한 프레임에 한 번 잰다** (passive `scroll` + rAF). 처음에는 항목이 가운데 띠를
 *   드나드는 `IntersectionObserver` 사건으로 쟀는데, 브라우저 실측에서 **단계를 건너뛰고
 *   맨 위로 돌아와도 0 이 아닌 채로 멈췄다**(#914). 사건은 띠를 넘는 순간에만 오고 빠른
 *   스크롤에서는 늦게 도착해, 그 사이의 위치 변화를 놓친다. 무대 셋의 항목 열 개를 한 프레임에
 *   재는 비용은 무시할 만하다. `setStep` 은 값이 같으면 다시 그리지 않는다.
 * - **뒤로 스크롤하면 내려간다.** 무대는 1회 재생이 아니라 스크롤 위치의 함수다 — 최대값으로
 *   누적하지 않는다.
 * - 감속 모션이면 재지 않는다. 스크롤과 함께 모양이 바뀌는 것 자체가 움직임이다.
 *
 * `live` 는 재기가 실제로 걸렸는지다. 강조(지금 단계만 칠하는 것)는 `live` 일 때만 켠다 —
 * 정적 렌더와 감속 모션에서 마지막 단계의 강조가 눌어붙지 않게.
 */
export function useActiveStep(count: number): {
  step: number
  live: boolean
  settling: boolean
  register: (index: number) => (node: Element | null) => void
} {
  const [step, setStep] = useState(count)
  const [live, setLive] = useState(false)
  const [settling, setSettling] = useState(false)
  const nodes = useRef<(Element | null)[]>([])

  const register = useCallback(
    (index: number) => (node: Element | null) => {
      nodes.current[index - 1] = node
    },
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const list = Array.from({ length: count }, (_, index) => nodes.current[index] ?? null)
    if (list.every((node) => node === null)) return

    const measure = () => {
      const tops = list.map((node) => (node === null ? null : node.getBoundingClientRect().top))
      setStep(stepAt(tops, window.innerHeight * ACTIVE_STEP_LINE))
    }

    let frame = 0
    const schedule = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    setSettling(true)
    measure()
    setLive(true)
    let settle = requestAnimationFrame(() => {
      settle = requestAnimationFrame(() => setSettling(false))
    })

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settle)
    }
  }, [count])

  return { step, live, settling, register }
}
