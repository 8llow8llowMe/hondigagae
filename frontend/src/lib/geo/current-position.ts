import { isInJeju } from '@/lib/geo/jeju-bounds'

/**
 * 현재 위치.
 *
 * **실패를 종류별로 구분한다.** "위치를 못 가져왔어요" 하나로 뭉치면 사용자가 다음에
 * 무엇을 할지 알 수 없다 — 권한을 다시 허용하면 되는지, 잠시 뒤 다시 눌러야 하는지,
 * 이 브라우저에서는 아예 안 되는지가 다르다.
 */

/**
 * 위치를 모를 때 **조회의 기준점**. 제주시청 부근이다.
 *
 * **`lib/geo/coord.ts` 의 `JEJU_CENTER`(한라산 부근, 섬의 기하 중심)와 다른 값이다.**
 * 두 상수가 같은 이름이면 반드시 섞인다 — 실제로 지도(#14)가 조회 기준점을 쓰려다
 * 기하 중심을 집어 첫 화면이 비었다. 이름으로 쓰임을 갈라 둔다:
 *  - `JEJU_QUERY_CENTER` — 좌표가 없을 때 **무엇을 조회할지**의 기준. 사람이 사는 쪽이다
 *  - `JEJU_CENTER`(coord.ts) — **지도를 어디에 놓을지**의 기준. 섬 전체가 담기는 쪽이다
 */
export const JEJU_QUERY_CENTER = { lat: 33.4996213, lng: 126.5311884 } as const

/**
 * `outside` — 좌표는 받았는데 **제주 밖**인 경우.
 *
 * 다른 셋과 성격이 다르다: 브라우저가 실패한 것이 아니라 **우리 데이터가 제주뿐**이다.
 * 제주 밖 좌표로 조회하면 오류가 아니라 조용한 0건이 와서(`lib/geo/jeju-bounds.ts`)
 * 화면이 고장처럼 보인다. 그래서 폴백으로 내려 제주 기준으로 조회한다.
 */
export type PositionFailure = 'denied' | 'timeout' | 'unsupported' | 'outside'

export type PositionResult =
  | { kind: 'granted'; lat: number; lng: number }
  | { kind: 'fallback'; lat: number; lng: number; reason: PositionFailure }

/** 10초. 이보다 길면 사용자가 화면이 멈춘 것으로 읽는다 */
const TIMEOUT_MS = 10_000

/**
 * 우리 시계에 주는 여유. 브라우저가 제 시간에 응답하면 그쪽이 이기게 두고,
 * 아무 말도 없을 때만 우리가 끊는다 — 정상 경로의 판정을 빼앗지 않는다.
 */
const GRACE_MS = 1_000

/**
 * **거부·타임아웃·미지원 어느 쪽이어도 좌표를 돌려준다.**
 *
 * 조회 자체는 `lat`/`lng` 가 필수라 좌표가 없으면 화면이 통째로 비어 버린다. 대신
 * 제주 중심으로 조회하고 **그 사실을 화면이 말한다** — `kind: 'fallback'` 이면
 * 거리를 표시하지 않는다. 제주 중심에서 480m 인 것을 "480m" 라고 쓰면 거짓말이다.
 *
 * **좌표를 받아도 제주 밖이면 폴백이다** (`reason: 'outside'`). 이 서비스의 데이터가
 * 제주뿐이라 제주 밖 좌표는 오류가 아니라 **조용한 0건**을 부른다 — 서울에서 열면
 * 병원·약국이 "반경 안에 없어요" 로만 보였다(dev 실측). 여기서 한 번 거르므로
 * 화면들은 "제주 안일 때만 내 위치 기준" 이라는 규칙을 따로 알 필요가 없다.
 */
export function getCurrentPosition(): Promise<PositionResult> {
  if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
    return Promise.resolve({ ...JEJU_QUERY_CENTER, kind: 'fallback', reason: 'unsupported' })
  }

  return new Promise((resolve) => {
    /*
      **플랫폼을 믿고 기다리기만 하지 않는다.**

      `timeout` 옵션은 브라우저가 콜백을 부르기로 했을 때의 상한일 뿐이다. 권한이 막힌
      일부 환경(내장 웹뷰·자동화 브라우저·기업 정책)에서는 **성공도 실패도 부르지 않고
      그냥 조용하다** — 실측으로 확인했다. 그러면 이 Promise 가 영영 pending 이고,
      호출부는 `position === null` 이라 **스켈레톤에서 멈춘다.**

      급할 때 여는 화면에서 그것은 "느리다" 가 아니라 "고장" 이다. 그래서 우리 시계로도
      한 번 끊고, 먼저 도착한 쪽을 쓴다.
    */
    let settled = false
    const finish = (result: PositionResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(
      () => finish({ ...JEJU_QUERY_CENTER, kind: 'fallback', reason: 'timeout' }),
      TIMEOUT_MS + GRACE_MS,
    )

    navigator.geolocation.getCurrentPosition(
      (position) =>
        finish(toResult({ lat: position.coords.latitude, lng: position.coords.longitude })),
      (error) => finish({ ...JEJU_QUERY_CENTER, kind: 'fallback', reason: toFailure(error) }),
      { timeout: TIMEOUT_MS, maximumAge: 5 * 60_000 },
    )
  })
}

/**
 * 브라우저가 준 좌표를 결과로 옮긴다. **제주 밖이면 폴백으로 내린다.**
 *
 * 좌표 자체는 버린다 — 남겨 두면 어느 화면이 "granted 니까 내 위치 기준" 이라고
 * 읽고 서울 좌표로 제주 데이터를 조회한다. 폴백 좌표 하나만 남기는 것이
 * "제주 밖에서는 제주 기준으로 본다" 를 구조로 못박는 방법이다.
 */
function toResult(point: { lat: number; lng: number }): PositionResult {
  if (!isInJeju(point)) {
    return { ...JEJU_QUERY_CENTER, kind: 'fallback', reason: 'outside' }
  }

  return { kind: 'granted', lat: point.lat, lng: point.lng }
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
