/**
 * 현재 위치.
 *
 * **실패를 종류별로 구분한다.** "위치를 못 가져왔어요" 하나로 뭉치면 사용자가 다음에
 * 무엇을 할지 알 수 없다 — 권한을 다시 허용하면 되는지, 잠시 뒤 다시 눌러야 하는지,
 * 이 브라우저에서는 아예 안 되는지가 다르다.
 */

/** 제주 중심. 위치를 모를 때 조회의 기준점으로만 쓴다 */
export const JEJU_CENTER = { lat: 33.4996213, lng: 126.5311884 } as const

export type PositionFailure = 'denied' | 'timeout' | 'unsupported'

export type PositionResult =
  | { kind: 'granted'; lat: number; lng: number }
  | { kind: 'fallback'; lat: number; lng: number; reason: PositionFailure }

/** 10초. 이보다 길면 사용자가 화면이 멈춘 것으로 읽는다 */
const TIMEOUT_MS = 10_000

/**
 * **거부·타임아웃·미지원 어느 쪽이어도 좌표를 돌려준다.**
 *
 * 조회 자체는 `lat`/`lng` 가 필수라 좌표가 없으면 화면이 통째로 비어 버린다. 대신
 * 제주 중심으로 조회하고 **그 사실을 화면이 말한다** — `kind: 'fallback'` 이면
 * 거리를 표시하지 않는다. 제주 중심에서 480m 인 것을 "480m" 라고 쓰면 거짓말이다.
 */
export function getCurrentPosition(): Promise<PositionResult> {
  if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
    return Promise.resolve({ ...JEJU_CENTER, kind: 'fallback', reason: 'unsupported' })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          kind: 'granted',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => resolve({ ...JEJU_CENTER, kind: 'fallback', reason: toFailure(error) }),
      { timeout: TIMEOUT_MS, maximumAge: 5 * 60_000 },
    )
  })
}

/**
 * `GeolocationPositionError` 를 화면이 쓰는 세 갈래로 좁힌다.
 *
 * `POSITION_UNAVAILABLE`(2)을 `timeout` 으로 묶는다 — 사용자가 할 수 있는 일이
 * "잠시 뒤 다시" 로 같기 때문이다. 권한은 다르다: 브라우저 설정을 바꿔야 한다.
 */
export function toFailure(error: { code: number }): PositionFailure {
  return error.code === 1 ? 'denied' : 'timeout'
}
