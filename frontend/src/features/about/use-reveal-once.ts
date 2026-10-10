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
 * ### 소비자 계약 (지키지 않으면 재생이 보이지 않는다)
 *
 * 소비자는 `armed` 동안 transition 을 끄고(`transition-none` 또는 인라인 `transition: 'none'`)
 * 숨김/시작 상태를 붙이고, `revealed` 에서 transition 을 켠다. 안 그러면 숨김 자체가 전환되어
 * 재생이 보이지 않는다 — 이미 보이는 요소에 전환이 켜진 채로 숨김을 붙이면 `armed` 프레임이
 * 페이드아웃의 **시작점**만 그리고, 한 프레임 뒤 숨김을 떼면 아무것도 재생되지 않는다.
 * 본보기는 `reveal.tsx`.
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
        /*
          `armed` 로 남겨 두지 않는다. 앞선 실행이 화면 밖이라 판단해 숨김을 걸어 둔 뒤
          `playIfVisible` 이 참에서 거짓으로 바뀌면, 되돌리지 않는 한 요소가 숨은 채로
          굳는다. 이미 `idle` 이면 무해하다.
        */
        setPhase('idle')
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
