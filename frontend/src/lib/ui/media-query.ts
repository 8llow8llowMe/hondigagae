'use client'

import { useSyncExternalStore } from 'react'

/**
 * 미디어 쿼리 구독.
 *
 * **CSS 로 감출 수 있으면 CSS 를 쓴다.** 이 훅은 *감추는 것으로는 부족할 때*만 쓴다 —
 * 무거운 것을 **아예 mount 하지 않아야** 하는 경우다. 지도가 그렇다: `hidden` 으로
 * 감춘 지도도 SDK 를 받아오고 인스턴스를 만든다. 급할 때 여는 긴급 시설 목록 화면에서
 * 보이지도 않는 지도가 네트워크를 쓰는 것은 그냥 낭비다.
 *
 * `useSyncExternalStore` 를 쓰는 이유는 **서버 스냅샷을 따로 줄 수 있어서**다.
 * 서버는 뷰포트를 모르므로 항상 `false` 로 렌더하고, 하이드레이션 직후 실제 값으로
 * 맞춘다 — `useEffect` + `useState` 로 하면 첫 페인트가 한 번 더 어긋난다.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => getSnapshot(query),
    // 서버는 뷰포트를 모른다. 좁은 화면을 기준으로 렌더하고 클라이언트가 넓힌다
    () => false,
  )
}

function subscribe(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return () => undefined

  const list = window.matchMedia(query)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function getSnapshot(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

/** Tailwind `lg` (64rem). 값을 화면마다 적지 않는다 — 브레이크포인트가 갈리면 레이아웃이 갈린다 */
export const LG_QUERY = '(min-width: 64rem)'

/**
 * Tailwind `md` (48rem). 팝오버냐 시트냐를 가르는 선이다 (`InfoTip`).
 *
 * **여기서는 CSS 로 감출 수 없다.** `md:hidden` 으로 시트를 감춰도 시트는 mount 된 채
 * `useOverlay` 를 걸어 Esc·포커스 이동·바탕 스크롤 잠금을 실행한다 — 보이지 않는 오버레이가
 * 키보드를 가로챈다. 둘 중 하나만 mount 해야 한다.
 */
export const MD_QUERY = '(min-width: 48rem)'
