'use client'

import { useRef } from 'react'

import { useScrollFrame } from '@/features/about/use-scroll-frame'

/**
 * 모바일 진행선 (#915, 명세 2026-09-25 §4) — 1024 미만에서 헤더 바로 아래 2px 선이 문서
 * 진행률만큼 찬다. 1024 이상은 절 내비가 그 몫을 한다.
 *
 * 위치 · 높이 · 색은 `app/globals.css` `.about-progress` 다(`top: var(--header-h)` 는
 * Tailwind 로 쓰면 arbitrary 라). `transform: scaleX` 만 바꾼다 — 레이아웃을 움직이지 않는다.
 * 전환을 걸지 않아 감속 모션에서도 따로 끌 것이 없다.
 */
export function ScrollProgressBar() {
  const ref = useRef<HTMLDivElement>(null)

  useScrollFrame(() => {
    const node = ref.current
    if (node === null) return
    const room = document.documentElement.scrollHeight - window.innerHeight
    const progress = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0
    node.style.transform = `scaleX(${progress})`
  })

  return <div ref={ref} aria-hidden className="about-progress lg:hidden" />
}
