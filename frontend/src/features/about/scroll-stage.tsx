'use client'

import { createContext, type ReactNode, useContext } from 'react'

import { useActiveStep } from '@/features/about/use-active-step'
import { cn } from '@/lib/utils/cn'

type StageContextValue = {
  step: number
  live: boolean
  register: (index: number) => (node: Element | null) => void
}

const StageContext = createContext<StageContextValue | null>(null)

/**
 * 단계 → 래퍼 클래스 (#914, 명세 2026-09-25 §3-3).
 *
 * - `is-step-1 … is-step-{step}` — **누적**이다. "아직 오지 않은 단계" 를 CSS 가
 *   `:not(.is-step-N)` 으로 숨긴다. 그래서 플래그가 전부 붙은 정적 렌더는 아무것도 숨기지
 *   않는다 — 끝 상태가 CSS 기본값이다.
 * - `is-current-{step}` — 지금 단계 하나. 강조(그 단계에만 칠하는 것)의 훅이다.
 * - `is-live` — 재기가 실제로 걸렸다. 강조와 항목 흐림은 이것이 있을 때만 켠다.
 * - `is-settling` — 마운트 직후 첫 맞춤의 두 프레임. 전환을 꺼서 끝 상태 → 실제 위치로의
 *   되감기가 "지우기" 로 재생되지 않게 한다.
 *
 * **Tailwind 대괄호 변형(`group-data-[step=2]:`)을 쓰지 않는다.** eslint `noComplexArbitrary`
 * 가 막고 단계마다 조합이 늘어 읽히지 않는다. 선택자는 `app/globals.css` 의 소개 페이지
 * 블록이 이름 클래스로 갖는다 (`surface-list-2col` 선례).
 */
export function stageClassName(step: number, live: boolean, settling = false): string {
  const flags = Array.from({ length: step }, (_, index) => `is-step-${index + 1}`)
  return cn(
    'about-stage',
    flags,
    `is-current-${step}`,
    live && 'is-live',
    settling && 'is-settling',
  )
}

/**
 * 스크롤 무대 (#914, 명세 2026-09-25 §3).
 *
 * 왼쪽 열(`copy`)의 `ScrollStagePoint` 가 화면 가운데 띠에 들어올 때마다 단계가 바뀌고,
 * 오른쪽 열(`visual`)의 예시가 그 단계 모양이 된다. 1024 이상에서 오른쪽 열은 sticky 다
 * (`globals.css` `.about-stage-visual`).
 *
 * **예시에 단계가 가는 길은 둘이다.** 장소 · 긴급 예시는 이 래퍼의 클래스로(긴급은 서버
 * 컴포넌트라 prop 을 받을 수 없고, 장소는 #916 에서 클라이언트가 됐지만 같은 CSS 를 쓴다),
 * 곡선 예시는 `useStageStep()` 컨텍스트로 받는다.
 *
 * **`copy` · `visual` 은 서버에서 렌더된 노드다.** 이 컴포넌트는 감싸기만 하고 문장을 갖지
 * 않는다 — 절 본문은 서버 컴포넌트로 남는다 (명세 2026-09-25 §9-1).
 */
export function ScrollStage({
  count,
  className,
  copyClassName,
  visualClassName,
  copy,
  visual,
}: {
  count: number
  className?: string
  copyClassName?: string
  visualClassName?: string
  copy: ReactNode
  visual: ReactNode
}) {
  const { step, live, settling, register } = useActiveStep(count)

  return (
    <StageContext.Provider value={{ step, live, register }}>
      <div className={cn(stageClassName(step, live, settling), className)}>
        <div className={copyClassName}>{copy}</div>
        <div className={cn('about-stage-visual', visualClassName)}>{visual}</div>
      </div>
    </StageContext.Provider>
  )
}

/**
 * 무대의 항목 하나 — `li` 를 그리고 관측 대상으로 등록한다.
 *
 * **문장은 children 으로 받는다.** 서버에서 렌더된 채로 들어오므로 문구 · 아이콘은 이
 * 클라이언트 경계로 끌려오지 않는다. 켜짐(`is-on`)은 `index <= step` 이고, 흐림은 `is-live`
 * 일 때만 CSS 가 준다 — 정적 렌더에서는 전부 켜져 있다.
 */
export function ScrollStagePoint({
  index,
  className,
  children,
}: {
  index: number
  className?: string
  children: ReactNode
}) {
  const stage = useContext(StageContext)
  const on = stage === null || index <= stage.step

  return (
    <li ref={stage?.register(index)} className={cn('about-stage-point', on && 'is-on', className)}>
      {children}
    </li>
  )
}

/**
 * 무대 밖이면 `null` — 곡선 예시가 스스로 1회 재생하는 기존 경로(`useRevealOnce`)로 돈다.
 */
export function useStageStep(): { step: number; live: boolean } | null {
  const stage = useContext(StageContext)
  return stage === null ? null : { step: stage.step, live: stage.live }
}
