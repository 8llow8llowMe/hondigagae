import { afterEach, describe, expect, it, vi } from 'vitest'

import { getOnlineSnapshot, getServerOnlineSnapshot, subscribeOnline } from '@/lib/hooks/use-online'

/**
 * `useOnline` 의 세 조각 — 이슈 #912.
 *
 * 훅 자체는 node 환경에서 렌더할 수 없어(`testing-guide.md` §1) **구독 · 스냅샷 함수를
 * 따로 잰다.** 훅은 이 셋을 `useSyncExternalStore` 에 넘기기만 한다.
 */
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('subscribeOnline', () => {
  it('online · offline 둘 다 듣고, 돌려준 함수가 둘 다 뗀다 — 화면을 오가도 쌓이지 않는다', () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const onChange = vi.fn()

    const unsubscribe = subscribeOnline(onChange)
    target.dispatchEvent(new Event('offline'))
    target.dispatchEvent(new Event('online'))
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe()
    target.dispatchEvent(new Event('offline'))
    target.dispatchEvent(new Event('online'))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('window 가 없으면(SSR) 아무것도 하지 않는 cleanup 을 돌려준다', () => {
    vi.stubGlobal('window', undefined)

    const unsubscribe = subscribeOnline(() => undefined)
    expect(() => unsubscribe()).not.toThrow()
  })
})

describe('스냅샷', () => {
  it('브라우저에서는 navigator.onLine 을 그대로 읽는다', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(getOnlineSnapshot()).toBe(false)

    vi.stubGlobal('navigator', { onLine: true })
    expect(getOnlineSnapshot()).toBe(true)
  })

  it('navigator 가 없으면 온라인으로 본다 — 오프라인은 단정할 때만 말한다', () => {
    vi.stubGlobal('navigator', undefined)
    expect(getOnlineSnapshot()).toBe(true)
  })

  it('서버 스냅샷은 true 다 — 첫 페인트마다 배너가 번쩍이면 안 된다', () => {
    expect(getServerOnlineSnapshot()).toBe(true)
  })
})
