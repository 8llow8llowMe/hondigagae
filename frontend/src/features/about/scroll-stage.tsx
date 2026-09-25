'use client'

import { createContext, type ReactNode, useContext, useRef } from 'react'

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
 * - `is-heading-gone` — 절 제목이 헤더 밑으로 들어갔다 (#940). 고정 카드 위 맥락 줄의 제목이
 *   이때 드러난다. `is-live` 와 함께일 때만 뜻이 있다.
 *
 * **Tailwind 대괄호 변형(`group-data-[step=2]:`)을 쓰지 않는다.** eslint `noComplexArbitrary`
 * 가 막고 단계마다 조합이 늘어 읽히지 않는다. 선택자는 `app/globals.css` 의 소개 페이지
 * 블록이 이름 클래스로 갖는다 (`surface-list-2col` 선례).
 */
export function stageClassName(
  step: number,
  live: boolean,
  settling = false,
  headingGone = false,
): string {
  const flags = Array.from({ length: step }, (_, index) => `is-step-${index + 1}`)
  return cn(
    'about-stage',
    flags,
    `is-current-${step}`,
    live && 'is-live',
    settling && 'is-settling',
    headingGone && 'is-heading-gone',
  )
}

/**
 * 스크롤 무대 (#914, 명세 2026-09-25 §3).
 *
 * 왼쪽 열(`copy`)의 `ScrollStagePoint` 중심이 기준선(헤더 아래 화면의 가운데)을 지날 때마다
 * 단계가 바뀌고, 오른쪽 열(`visual`)의 예시가 그 단계 모양이 된다.
 *
 * **1024 이상의 오른쪽 열은 헤더 아래 화면 높이의 sticky 틀이다** (#940). 예시는 그 틀 안에서
 * 세로 가운데에 서고(`.about-stage-frame`, 위아래 여백이 같아 카드 중심 = 틀 중심), 틀이 기준선과
 * 같은 중심을 가져 켜지는 항목과 카드 한가운데가 수평이 된다(질문 2 는 개 + 카드 덩어리).
 * 카피 열 끝의 꼬리 여백(`.about-stage-copy`)은 마지막 항목이 켜지는 바로 그 순간 무대 끝이
 * 화면 바닥에 닿게 한다 — 그다음 스크롤부터 문장과 예시가 함께 올라간다.
 *
 * **`context` 는 고정 카드 위 맥락 줄이다** (#940, 1024 이상만). 절 제목은 항목 2 부터 화면
 * 밖이라 예시만 남는데, 맥락 줄이 `표지어 · 제목`(제목이 사라진 뒤 드러남)과 바로가기를 카드
 * 위에 붙여 둔다. 카드 윗변 기준 `absolute` 라 틀의 위 여백 안에 선다 — 질문 2 는 캐릭터 자리
 * (`frameClassName="about-pose-room"`) 안의 왼쪽이다.
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
  frameClassName,
  copy,
  visual,
  context,
}: {
  count: number
  className?: string
  copyClassName?: string
  /** 오른쪽 열(sticky 틀) — 그리드 자리만 */
  visualClassName?: string
  /** 틀 안에서 가운데 서는 덩어리 — 캐릭터 자리(`about-pose-room`)처럼 예시와 함께 움직일 여백 */
  frameClassName?: string
  copy: ReactNode
  visual: ReactNode
  /** 고정 카드 위 맥락 줄 (1024 이상) */
  context?: ReactNode
}) {
  const copyRef = useRef<HTMLDivElement>(null)
  const { step, live, settling, headingGone, register } = useActiveStep(count, copyRef)

  return (
    <StageContext.Provider value={{ step, live, register }}>
      <div className={cn(stageClassName(step, live, settling, headingGone), className)}>
        <div ref={copyRef} className={cn('about-stage-copy', copyClassName)}>
          {copy}
        </div>
        <div className={cn('about-stage-visual', visualClassName)}>
          <div className={cn('about-stage-frame', frameClassName)}>
            <div className="relative">
              {context !== undefined && <div className="about-stage-context">{context}</div>}
              {visual}
            </div>
          </div>
        </div>
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
 *
 * `is-active` 는 지금 항목 하나(번호 칸의 고리), `is-past` 는 지나온 항목(번호 잇는 선을 채움)이다
 * (#940). 둘 다 `is-live` 아래에서만 칠한다.
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
  const step = stage === null ? index : stage.step
  const on = index <= step

  return (
    <li
      ref={stage?.register(index)}
      className={cn(
        'about-stage-point',
        on && 'is-on',
        index === step && 'is-active',
        index < step && 'is-past',
        className,
      )}
    >
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
