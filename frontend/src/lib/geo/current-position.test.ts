import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCurrentPosition, toFailure } from '@/lib/geo/current-position'

type GeoSuccess = (position: { coords: { latitude: number; longitude: number } }) => void
type GeoError = (error: { code: number }) => void

function stubGeolocation(impl: (ok: GeoSuccess, fail: GeoError) => void) {
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: impl } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('toFailure', () => {
  it('권한 거부(1)와 그 외를 가른다 — 사용자가 할 수 있는 일이 다르다', () => {
    expect(toFailure({ code: 1 })).toBe('denied')
    expect(toFailure({ code: 2 })).toBe('timeout')
    expect(toFailure({ code: 3 })).toBe('timeout')
  })
})

describe('getCurrentPosition', () => {
  it('성공하면 실제 좌표를 준다', async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 33.51, longitude: 126.52 } }))

    await expect(getCurrentPosition()).resolves.toEqual({
      kind: 'granted',
      lat: 33.51,
      lng: 126.52,
    })
  })

  it('거부되면 제주 중심으로 떨어지고 이유를 남긴다', async () => {
    stubGeolocation((_ok, fail) => {
      fail({ code: 1 })
    })

    const result = await getCurrentPosition()

    expect(result.kind).toBe('fallback')
    expect(result).toMatchObject({ reason: 'denied' })
  })

  /**
   * 권한이 막힌 일부 환경은 **성공도 실패도 부르지 않는다** (실측). 그때 이 Promise 가
   * 영영 pending 이면 급할 때 여는 화면이 스켈레톤에서 멈춘다.
   */
  it('플랫폼이 아무 콜백도 부르지 않으면 우리 시계로 끊는다', async () => {
    vi.useFakeTimers()
    stubGeolocation(() => undefined)

    const pending = getCurrentPosition()
    await vi.advanceTimersByTimeAsync(11_000)

    await expect(pending).resolves.toMatchObject({ kind: 'fallback', reason: 'timeout' })
  })

  it('브라우저가 제 시간에 답하면 그 판정이 이긴다 — 우리 타이머가 덮어쓰지 않는다', async () => {
    vi.useFakeTimers()
    stubGeolocation((_ok, fail) => {
      setTimeout(() => fail({ code: 1 }), 100)
    })

    const pending = getCurrentPosition()
    await vi.advanceTimersByTimeAsync(11_000)

    await expect(pending).resolves.toMatchObject({ reason: 'denied' })
  })

  it('geolocation 이 없는 환경은 unsupported 로 떨어진다', async () => {
    vi.stubGlobal('navigator', {})

    await expect(getCurrentPosition()).resolves.toMatchObject({
      kind: 'fallback',
      reason: 'unsupported',
    })
  })
})
