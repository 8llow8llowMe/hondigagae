'use client'

import { type RefObject, useEffect, useRef, useState } from 'react'

export type RevealPhase = 'idle' | 'armed' | 'revealed'

/**
 * 1회 등장/재생 위상 (#635, 명세 §6-4).
 *
 * - 마운트 시 요소가 **뷰포트 아래**면 `armed`(숨김) → 뷰포트 하단 10% 안으로 들어오면 `revealed`.
 * - 마운트 시 **이미 보이면**: `playIfVisible` 이 참일 때만 `armed` → 두 프레임 뒤 `revealed`
 *   로 밟아 1회 재생한다(히어로 예시 · 데스크톱에서 첫 화면에 걸린 예시). 거짓이면 `idle`
 *   그대로 — 로드 시 보이는 요소는 등장 애니메이션을 하지 않는다.
 * - `IntersectionObserver` 가 없으면 `idle`. **어느 경로에서도 처음 렌더는 `idle`(보임)이다.**
 *
 * 두 프레임을 쓰는 이유: `armed` 가 한 번 그려진 뒤에 `revealed` 로 바뀌어야 CSS transition
 * 이 시작점을 갖는다. 같은 프레임에 두 상태를 바꾸면 전환 없이 끝 상태만 그려진다.
 *
 * `done` 은 StrictMode 의 이펙트 이중 실행과 재관측을 막는다 — 재생은 1회다.
 */
export function useRevealOnce<T extends Element>(
  ref: RefObject<T | null>,
  playIfVisible: boolean,
): RevealPhase {
  const [phase, setPhase] = useState<RevealPhase>('idle')
  const done = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (node === null || done.current) return
    if (typeof IntersectionObserver === 'undefined') return

    const reveal = () => {
      done.current = true
      setPhase('revealed')
    }

    const rect = node.getBoundingClientRect()
    const visible = rect.top < window.innerHeight && rect.bottom > 0

    if (visible) {
      if (!playIfVisible) {
        done.current = true
        return
      }
      setPhase('armed')
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(reveal)
      })
      return () => cancelAnimationFrame(frame)
    }

    setPhase('armed')
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal()
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, playIfVisible])

  return phase
}
