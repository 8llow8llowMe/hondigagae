'use client'

import { useSyncExternalStore } from 'react'

/**
 * 브라우저가 네트워크에 붙어 있는가 — 이슈 #912.
 *
 * **`useSyncExternalStore` 다** (`lib/ui/media-query.ts` 와 같은 이유). 서버 스냅샷을 따로
 * 줄 수 있어 SSR 에서 `window`·`navigator` 를 건드리지 않고, 하이드레이션 직후 실제 값으로
 * 맞춘다. `useEffect` + `useState` 로 하면 첫 페인트가 한 번 더 어긋난다.
 *
 * **서버 스냅샷은 `true` 다.** 서버가 응답을 만들었다는 것 자체가 연결돼 있다는 뜻이고,
 * `false` 로 두면 모든 첫 페인트에 오프라인 배너가 번쩍인다.
 *
 * **`navigator.onLine` 의 `true` 는 "인터넷이 된다" 가 아니다** — 랜선·와이파이에 붙어 있다는
 * 뜻뿐이다. 그래서 이 값으로 **오프라인을 단정할 때만** 쓴다(`false` 는 믿을 만하다).
 * 온라인인데 서버가 죽은 경우는 여전히 5xx 갈래가 말한다.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot)
}

/**
 * `online`/`offline` 이벤트 구독. **돌려주는 함수가 cleanup 이다** — React 가 언마운트·
 * 구독 교체 때 부른다. 둘 다 떼지 않으면 화면을 오갈 때마다 리스너가 쌓인다.
 */
export function subscribeOnline(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined

  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function getOnlineSnapshot(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function getServerOnlineSnapshot(): boolean {
  return true
}
