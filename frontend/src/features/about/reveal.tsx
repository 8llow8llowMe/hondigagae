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
        'transition duration-200 ease-out',
        phase === 'armed' && REVEAL_HIDDEN_CLASS,
        className,
      )}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
