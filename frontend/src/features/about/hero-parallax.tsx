'use client'

import { type ReactNode, useRef, useState } from 'react'

import { ChevronDownIcon } from '@/components/icons'
import { prefersReducedMotion, useScrollFrame } from '@/features/about/use-scroll-frame'
import { cn } from '@/lib/utils/cn'

/** 스크롤 대비 카드가 거슬러 오르는 비율과 그 상한(스크롤 px) — 최대 108px (명세 2026-09-25 §4) */
export const PARALLAX_RATIO = 0.12
export const PARALLAX_MAX_SCROLL = 900

/** 스크롤 힌트가 사라지는 스크롤 거리 */
export const SCROLL_CUE_HIDE_AFTER = 40

/**
 * 히어로 판정 카드 패럴랙스 (#915, 명세 2026-09-25 §4).
 *
 * 1024 이상에서만 카드가 스크롤의 0.12배로 거슬러 오른다. **장식이라 감속 모션이면 멈춘다.**
 * 상태가 아니라 ref 로 `transform` 을 직접 고친다 — 스크롤 한 프레임마다 다시 그리지 않게.
 * 정적 렌더에는 `transform` 이 없다.
 */
export function HeroParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useScrollFrame(() => {
    const node = ref.current
    if (node === null) return
    const desktop = window.matchMedia('(min-width: 64rem)').matches
    if (!desktop || prefersReducedMotion()) {
      node.style.transform = ''
      return
    }
    const shift = Math.min(window.scrollY, PARALLAX_MAX_SCROLL) * PARALLAX_RATIO
    node.style.transform = `translate3d(0, ${-shift}px, 0)`
  })

  return <div ref={ref}>{children}</div>
}

/**
 * 스크롤 힌트 — 1024 이상 히어로 카피 아래 한 줄 (#915). 40px 을 내려가면 사라지고 다시
 * 나타나지 않는 것처럼 보이지만, 맨 위로 돌아오면 다시 선다. **반복 애니메이션은 없다.**
 *
 * 사라진 동안에는 포커스 순서와 접근성 트리에서도 빠진다(`tabIndex=-1` · `aria-hidden`).
 */
export function ScrollCue({ href, children }: { href: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false)

  useScrollFrame(() => setHidden(window.scrollY > SCROLL_CUE_HIDE_AFTER))

  return (
    <a
      href={href}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn(
        'text-caption mt-10 hidden min-h-11 items-center gap-1.5 font-semibold transition-opacity duration-150 ease-out lg:inline-flex',
        'focus-visible:ring-fg-inverse focus-visible:ring-2 focus-visible:outline-none',
        hidden ? 'pointer-events-none opacity-0' : 'opacity-90',
      )}
    >
      <ChevronDownIcon size={16} />
      {children}
    </a>
  )
}
