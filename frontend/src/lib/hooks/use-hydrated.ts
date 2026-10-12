'use client'

import { useSyncExternalStore } from 'react'

/**
 * 하이드레이션이 끝났는가 — 이슈 #1381.
 *
 * **브라우저 저장소(`localStorage` · `sessionStorage`)로 초기값을 정하는 컴포넌트를 이것으로 막는다.**
 * 서버는 저장소를 못 읽어 다른 값을 그리고, React 19 는 속성 불일치를 고치지 않고 경고만 낸다 —
 * 체크는 클라이언트 값인데 선택 행 강조는 서버 값에 남는 식으로 갈린다.
 *
 * `useSyncExternalStore` 의 서버 스냅샷(`false`)이 서버 렌더와 하이드레이션 첫 렌더에 쓰이고, 그 뒤
 * 클라이언트 스냅샷(`true`)으로 다시 그린다. `useEffect` + `useState` 보다 렌더가 한 번 적고, 하이드레이션
 * 뒤에 마운트되는 컴포넌트에서는 처음부터 `true` 다. `use-online.ts` 와 같은 모양이다.
 */
export function subscribeHydrated(): () => void {
  // 바뀔 일이 없다 — 한 번 클라이언트면 계속 클라이언트다
  return () => undefined
}

export function getHydratedSnapshot(): boolean {
  return true
}

export function getHydratedServerSnapshot(): boolean {
  return false
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydrated, getHydratedSnapshot, getHydratedServerSnapshot)
}
