'use client'

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

/**
 * 단계를 세는 기준선 — **헤더 아래 화면의 세로 가운데** (#940, 명세 2026-09-25 §3-4 개정).
 *
 * 1024 이상의 고정 예시는 헤더 아래 화면 높이의 틀 안에서 세로 가운데에 선다
 * (`globals.css` `.about-stage-visual`). 기준선이 그 중심과 같아야 켜지는 항목이 카드 한가운데와
 * 수평이 된다(질문 1 · 위급 — 질문 2 는 개 + 카드 덩어리의 한가운데). 예전 기준선(뷰포트
 * 가운데)은 헤더 높이의 절반만큼 위에 있었다.
 */
export function activeStepLine(viewportHeight: number, headerHeight: number): number {
  return headerHeight + (viewportHeight - headerHeight) / 2
}

/**
 * 위치들 → 단계. **위치가 기준선을 지난 마지막 항목의 번호**(1-based)다. 무대는 항목 **중심**을
 * 넘기고, 절 내비(`section-nav.tsx`)는 절 윗변을 넘긴다.
 *
 * **무대가 윗변이 아니라 중심을 넘기는 이유** (#940). 1024 이상에서 항목 하나는 58vh 칸이고 문장은 그 칸의
 * 가운데에 선다 — 윗변으로 재면 문장이 기준선보다 29vh 아래 있을 때 켜져, "가운데에 온 문장이
 * 켜진다" 가 아니었다. 1024 미만의 짧은 항목에서도 중심이 문장 위치다.
 *
 * - 기준선이 항목 사이에 있으면 위 항목 · 무대를 지나왔으면 마지막 번호 · 아직 안 왔으면 0.
 * - `null`(등록되지 않은 항목)은 건너뛰되 **번호는 원래 자리 그대로 센다** — 걸러낸 뒤 다시
 *   세면 뒤 번호가 한 칸씩 당겨지고, 마지막 단계에만 드러나는 내용(특보 띠 · 진입 행)이
 *   `is-live` 아래에서 영영 숨는다.
 *
 * 순수 함수로 뗀 이유: 훅은 node 테스트 환경에서 돌릴 수 없어, 이 식이 틀려도(한 칸 어긋남 ·
 * 방향 뒤집힘 · 틈을 아래 항목으로 셈) 소스 가드는 전부 통과한다.
 */
export function stepAt(positions: readonly (number | null)[], line: number): number {
  let step = 0
  positions.forEach((position, index) => {
    if (position !== null && position <= line) step = index + 1
  })
  return step
}

/**
 * `--header-h` 를 읽는다 — 768 에서 56 → 64 로 바뀌는 토큰이라(`tokens.css`) 숫자를 박지 않는다.
 * 재기마다 읽어도 되는 값이지만 계산 스타일을 매 프레임 부르지 않도록 `resize` 에서만 다시 읽는다.
 * **토큰이 px 이라는 전제다** — rem 으로 바뀌면 `parseFloat` 가 3.5 처럼 읽는다.
 * `scroll-stage.test.ts` 가 토큰 단위를 잠근다.
 */
function readHeaderHeight(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--header-h')
  return Number.parseFloat(value) || 0
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
 * - `copy`(카피 열)를 주면 그 안의 절 제목(`h2`)이 헤더 밑으로 들어갔는지(`headingGone`)도 같은
 *   프레임에 잰다 (#940 맥락 줄). 제목은 서버가 그린 노드라 ref 를 직접 걸 수 없어 열에서 찾는다. 감속 모션 · 정적 렌더에서는 `false` 로 남는다 — CSS 는 `is-live` 일
 *   때만 그 값으로 맥락 줄 제목을 숨기므로, 재지 않는 환경에서는 제목이 늘 보인다.
 *
 * `live` 는 재기가 실제로 걸렸는지다. 강조(지금 단계만 칠하는 것)는 `live` 일 때만 켠다 —
 * 정적 렌더와 감속 모션에서 마지막 단계의 강조가 눌어붙지 않게.
 */
export function useActiveStep(
  count: number,
  copy?: RefObject<Element | null>,
): {
  step: number
  live: boolean
  settling: boolean
  headingGone: boolean
  register: (index: number) => (node: Element | null) => void
} {
  const [step, setStep] = useState(count)
  const [live, setLive] = useState(false)
  const [settling, setSettling] = useState(false)
  const [headingGone, setHeadingGone] = useState(false)
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

    const title = copy?.current?.querySelector('h2') ?? null
    let headerHeight = readHeaderHeight()
    const measure = () => {
      const centers = list.map((node) => {
        if (node === null) return null
        const rect = node.getBoundingClientRect()
        return rect.top + rect.height / 2
      })
      setStep(stepAt(centers, activeStepLine(window.innerHeight, headerHeight)))
      /* 절 제목이 헤더 밑으로 들어갔는지 — 고정 카드 위 맥락 줄의 제목이 이때 드러난다 */
      if (title !== null) setHeadingGone(title.getBoundingClientRect().bottom <= headerHeight)
    }

    let frame = 0
    const schedule = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    const onResize = () => {
      headerHeight = readHeaderHeight()
      schedule()
    }
    /*
      문서 높이가 스크롤 없이 바뀌면(1024 미만에서 질문 3 탭을 바꿔 카드 높이가 달라지는 등 — #940
      검토) 아래 무대가 밀린 채 다음 스크롤까지 단계가 어긋난다. 본문 크기가 바뀔 때도 다시 잰다.
    */
    const layout = new ResizeObserver(schedule)
    layout.observe(document.body)

    setSettling(true)
    measure()
    setLive(true)
    let settle = requestAnimationFrame(() => {
      settle = requestAnimationFrame(() => setSettling(false))
    })

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
      layout.disconnect()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settle)
    }
  }, [count, copy])

  return { step, live, settling, headingGone, register }
}
