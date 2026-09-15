'use client'

import { type ReactNode, useRef } from 'react'

import { useRevealOnce } from '@/features/about/use-reveal-once'
import { cn } from '@/lib/utils/cn'

/** 숨김 상태 — 12px 아래 · 투명. 테스트가 정적 마크업에 이것이 **없음**을 단언한다 */
export const REVEAL_HIDDEN_CLASS = 'translate-y-3 opacity-0'

/**
 * 스크롤 등장 (#635, 명세 §6-4 1단).
 *
 * 항상 `div` 다 — `li` 안에 넣을 때는 `<li><Reveal>…</Reveal></li>` 로 감싼다. 태그를 prop
 * 으로 열면 ref 타입이 태그마다 갈려 `exactOptionalPropertyTypes` 아래서 캐스팅이 필요해진다.
 *
 * `delay` 는 형제 사이 60ms 간격용이다. 값이 0 이면 `style` 을 아예 내지 않는다.
 *
 * **`armed` 동안에는 transition 을 끈다.** 요소는 이미 보이는 채로 칠해져 있어, 전환이 켜진
 * 상태에서 숨김 클래스를 붙이면 그 붙임 자체가 200ms 페이드아웃으로 전환된다 — `armed`
 * 프레임은 시작점만 그리고, 다음 프레임에 클래스를 떼면 눈에 보이는 재생이 없다. 꺼 두면
 * 숨김이 즉시 칠해지고, `revealed` 에서 전환이 켜지며 그 지점부터 등장이 재생된다.
 *
 * `Reveal` 자신은 `playIfVisible: false` 라 이 경로를 타지 않지만, `useRevealOnce` 를 직접
 * 쓰는 Task 4~6 의 표본이 그대로 베낄 계약이므로 여기서 형태를 잡는다.
 */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const phase = useRevealOnce(ref, false)

  return (
    <div
      ref={ref}
      className={cn(
        phase === 'armed'
          ? cn('transition-none', REVEAL_HIDDEN_CLASS)
          : 'transition duration-200 ease-out',
        className,
      )}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
