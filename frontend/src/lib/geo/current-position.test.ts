import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getCurrentPosition,
  getPositionIfGranted,
  JEJU_QUERY_CENTER,
  offersLocate,
  type PositionFailure,
  type PositionResult,
  toFailure,
} from '@/lib/geo/current-position'

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

  /*
    **좌표를 정확히 받았는데도 폴백이다.** 브라우저가 실패한 것이 아니라 우리 데이터가
    제주뿐이라, 서울 좌표로 조회하면 오류가 아니라 조용한 0건이 온다 (dev 실측:
    `/emergencies/facilities` 가 200 + `facilities: []`). 그러면 화면이 고장으로 보인다.
  */
  it('제주 밖 좌표는 제주 중심으로 내리고 outside 로 표시한다', async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 37.5665, longitude: 126.978 } }))

    const result = await getCurrentPosition()

    expect(result).toEqual({ ...JEJU_QUERY_CENTER, kind: 'fallback', reason: 'outside' })
  })

  /* 서울 좌표를 그대로 들고 있으면 어느 화면이 "granted 니까 내 위치 기준" 으로 읽는다 */
  it('제주 밖 좌표를 결과에 남기지 않는다', async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 37.5665, longitude: 126.978 } }))

    const result = await getCurrentPosition()

    expect(result.lat).not.toBe(37.5665)
    expect(result.lng).not.toBe(126.978)
  })

  it('추자도는 제주 안이다 — 행정상 제주시다', async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 34.0577, longitude: 126.3241 } }))

    await expect(getCurrentPosition()).resolves.toMatchObject({ kind: 'granted' })
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

/*
  **화면 진입에서 권한 팝업을 띄우지 않는다** (#1133). Lighthouse `geolocation-on-start` 가
  홈과 `/places` 에서 실패했다 — 검색으로 처음 들어온 사람에게 첫 화면 팝업은 이탈 요인이다.

  그래서 진입 시 부르는 쪽은 **이미 허용된 경우에만** 좌표를 읽는다. 단언의 핵심은 결과보다
  **`geolocation.getCurrentPosition` 이 불렸는가**다 — 불리는 순간 브라우저가 묻는다.
*/
describe('getPositionIfGranted', () => {
  type PermissionQuery = (descriptor: { name: string }) => Promise<{ state: string }>

  function stubNavigator({
    query,
    position = { latitude: 33.51, longitude: 126.52 },
  }: {
    query?: PermissionQuery
    position?: { latitude: number; longitude: number }
  }) {
    const geolocate = vi.fn((ok: GeoSuccess) => ok({ coords: position }))
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: geolocate },
      ...(query === undefined ? {} : { permissions: { query } }),
    })
    return geolocate
  }

  it('이미 허용됐으면 실제 좌표를 읽는다', async () => {
    const query = vi.fn<PermissionQuery>(() => Promise.resolve({ state: 'granted' }))
    const geolocate = stubNavigator({ query })

    await expect(getPositionIfGranted()).resolves.toEqual({
      kind: 'granted',
      lat: 33.51,
      lng: 126.52,
    })
    expect(query).toHaveBeenCalledWith({ name: 'geolocation' })
    expect(geolocate).toHaveBeenCalledTimes(1)
  })

  /* 허용됐어도 제주 밖이면 `getCurrentPosition()` 의 규칙(outside 폴백)을 그대로 따른다 */
  it('허용됐어도 제주 밖이면 outside 폴백이다 — 같은 함수를 거친다', async () => {
    stubNavigator({
      query: () => Promise.resolve({ state: 'granted' }),
      position: { latitude: 37.5665, longitude: 126.978 },
    })

    await expect(getPositionIfGranted()).resolves.toEqual({
      ...JEJU_QUERY_CENTER,
      kind: 'fallback',
      reason: 'outside',
    })
  })

  it('아직 묻지 않았으면(prompt) 묻지 않고 unasked 폴백이다', async () => {
    const geolocate = stubNavigator({ query: () => Promise.resolve({ state: 'prompt' }) })

    await expect(getPositionIfGranted()).resolves.toEqual({
      ...JEJU_QUERY_CENTER,
      kind: 'fallback',
      reason: 'unasked',
    })
    expect(geolocate).not.toHaveBeenCalled()
  })

  it('거부됐으면 묻지 않고 denied 폴백이다', async () => {
    const geolocate = stubNavigator({ query: () => Promise.resolve({ state: 'denied' }) })

    await expect(getPositionIfGranted()).resolves.toEqual({
      ...JEJU_QUERY_CENTER,
      kind: 'fallback',
      reason: 'denied',
    })
    expect(geolocate).not.toHaveBeenCalled()
  })

  /*
    Permissions API 가 없다고 위치를 못 쓰는 것은 아니다 — 버튼을 누르면 물을 수 있다.
    그래서 `unsupported` 가 아니라 `unasked` 다. `unsupported` 면 화면이 "내 위치" 를 감춘다.
  */
  it('Permissions API 가 없으면 묻지 않고 unasked 폴백이다', async () => {
    const geolocate = stubNavigator({})

    await expect(getPositionIfGranted()).resolves.toEqual({
      ...JEJU_QUERY_CENTER,
      kind: 'fallback',
      reason: 'unasked',
    })
    expect(geolocate).not.toHaveBeenCalled()
  })

  /* 일부 브라우저는 `geolocation` 이름을 몰라 TypeError 로 거절한다 */
  it('query 가 거절되면 묻지 않고 unasked 폴백이다', async () => {
    const geolocate = stubNavigator({
      query: () => Promise.reject(new TypeError('unsupported permission name')),
    })

    await expect(getPositionIfGranted()).resolves.toMatchObject({
      kind: 'fallback',
      reason: 'unasked',
    })
    expect(geolocate).not.toHaveBeenCalled()
  })

  it('query 가 동기로 던져도 묻지 않고 unasked 폴백이다', async () => {
    const geolocate = stubNavigator({
      query: () => {
        throw new TypeError('Illegal invocation')
      },
    })

    await expect(getPositionIfGranted()).resolves.toMatchObject({
      kind: 'fallback',
      reason: 'unasked',
    })
    expect(geolocate).not.toHaveBeenCalled()
  })

  it('geolocation 자체가 없으면 unsupported 다 — 눌러도 같은 답이다', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: () => Promise.resolve({ state: 'granted' }) },
    })

    await expect(getPositionIfGranted()).resolves.toMatchObject({
      kind: 'fallback',
      reason: 'unsupported',
    })
  })
})

describe('offersLocate', () => {
  const fallback = (reason: PositionFailure): PositionResult => ({
    ...JEJU_QUERY_CENTER,
    kind: 'fallback',
    reason,
  })

  it('허용돼 제주 안이면 "내 위치" 를 그린다', () => {
    expect(offersLocate({ kind: 'granted', lat: 33.51, lng: 126.52 })).toBe(true)
  })

  /* 진입에서 묻지 않으므로 묻는 자리가 그 버튼뿐이다 — 감추면 위치를 켤 길이 없다 */
  it('아직 묻지 않았으면(unasked) 그린다', () => {
    expect(offersLocate(fallback('unasked'))).toBe(true)
  })

  it('거부 · 미지원 · 제주 밖 · 타임아웃이면 그리지 않는다 — 눌러도 같은 답이다', () => {
    for (const reason of ['denied', 'unsupported', 'outside', 'timeout'] as const) {
      expect(offersLocate(fallback(reason))).toBe(false)
    }
  })
})
