import { describe, expect, it } from 'vitest'

import {
  getHydratedServerSnapshot,
  getHydratedSnapshot,
  subscribeHydrated,
} from '@/lib/hooks/use-hydrated'

/**
 * `useHydrated` 의 세 조각 — 이슈 #1381.
 *
 * 훅은 node 환경에서 렌더할 수 없어(`testing-guide.md` §1) `useSyncExternalStore` 에 넘기는 조각을
 * 잰다 (`use-online.test.ts` 와 같은 방식).
 */
describe('useHydrated 조각', () => {
  it('서버 스냅샷은 false — 서버 렌더와 하이드레이션 첫 렌더가 같은 값을 그린다', () => {
    expect(getHydratedServerSnapshot()).toBe(false)
  })

  it('클라이언트 스냅샷은 true', () => {
    expect(getHydratedSnapshot()).toBe(true)
  })

  it('구독할 것이 없다 — 돌려준 cleanup 이 던지지 않는다', () => {
    const unsubscribe = subscribeHydrated()
    expect(() => unsubscribe()).not.toThrow()
  })
})
