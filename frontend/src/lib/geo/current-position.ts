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
/**
 * `unasked` — **권한을 묻지 않았다** (#1133). `getPositionIfGranted()` 만 낸다.
 *
 * 실패가 아니라 "아직 모른다" 다. 화면 진입에서는 권한 팝업을 띄우지 않으므로, 허용
 * 전(prompt)이거나 Permissions API 로 알 수 없으면 좌표를 읽지 않고 이 값으로 내린다.
 * `denied`·`unsupported` 와 갈라 둔 이유는 **다음 행동이 다르기 때문**이다 — 사용자가
 * "내 위치" 를 누르면 그때 물을 수 있다. 그래서 그 버튼을 감추면 안 된다.
 *
 * `getCurrentPosition()` 은 **언제나 묻기 때문에** 이 값을 내지 않는다. 그것만 쓰는
 * 긴급 시설 화면의 문구 분기가 이 갈래를 모르는 이유다.
 */
export type PositionFailure = 'denied' | 'timeout' | 'unsupported' | 'outside' | 'unasked'

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
 * **이미 허용된 경우에만** 현재 위치를 읽는다. 권한을 묻지 않는다 (#1133).
 *
 * 화면 진입에서 자동으로 부르는 쪽(홈 · `/places` 지도)이 쓴다. 진입하자마자
 * `getCurrentPosition()` 을 부르면 브라우저가 권한 팝업을 띄운다 — Lighthouse 가
 * `geolocation-on-start` 로 잡았고, 검색으로 처음 들어온 사람에게 첫 화면 팝업은
 * 무엇을 왜 허용하라는지 모르는 채 받는 질문이라 이탈 요인이다.
 *
 * **묻는 것은 사용자가 누른 버튼의 몫이다** — "내 위치" 버튼은 그대로
 * `getCurrentPosition()` 을 부른다. 그 순간에는 왜 묻는지가 화면에 드러나 있다.
 *
 * 허용(`granted`)이면 `getCurrentPosition()` 을 그대로 거친다 — 제주 밖 폴백·우리 시계
 * 규칙을 여기서 다시 짜지 않는다. 그 밖에는 **같은 모양의 폴백**(제주 기준 좌표)이라
 * 호출부는 지금까지처럼 좌표 하나로 조회한다:
 *  - `denied` → `denied`. 거부한 사람에게 다시 물을 수 없다
 *  - `prompt` · Permissions API 없음 · `query` 실패 → `unasked`. 모를 뿐 물을 수는 있다
 *    (Permissions API 가 없다고 `unsupported` 로 내리면 화면이 "내 위치" 를 감춘다)
 */
export async function getPositionIfGranted(): Promise<PositionResult> {
  if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
    return { ...JEJU_QUERY_CENTER, kind: 'fallback', reason: 'unsupported' }
  }

  const state = await readGeolocationPermission()

  if (state === 'granted') return getCurrentPosition()

  return {
    ...JEJU_QUERY_CENTER,
    kind: 'fallback',
    reason: state === 'denied' ? 'denied' : 'unasked',
  }
}

/**
 * 진입 때 읽은 결과로 **"내 위치" 버튼을 그릴지** 정한다 (#1133).
 *
 * 허용돼 제주 안이면 당연히 그리고, **아직 묻지 않았어도(`unasked`) 그린다** — 진입에서
 * 묻지 않으니 묻는 자리가 그 버튼뿐이다. 감추면 위치를 켤 길이 사라진다. 거부·미지원·
 * 제주 밖은 눌러도 같은 답이라 그리지 않는다. `timeout` 도 그리지 않는다 — 진입에서는
 * 나오지 않는 갈래(묻지 않았으니)지만, 나온다면 "지금 위치를 못 잡는다" 는 뜻이다.
 */
export function offersLocate(result: PositionResult): boolean {
  return result.kind === 'granted' || result.reason === 'unasked'
}

/**
 * 위치 권한 상태. **알 수 없으면 `unknown`** 이다 — 던지지 않는다.
 *
 * `navigator.permissions` 가 없는 브라우저가 있고, 있어도 `geolocation` 이름을 몰라
 * 거절(TypeError)하는 구현이 있다. 어느 쪽이든 "허용됐다고 확인하지 못했다" 이므로 묻지
 * 않는 쪽으로 떨어진다.
 */
async function readGeolocationPermission(): Promise<PermissionState | 'unknown'> {
  // 타입 정의는 늘 있다고 말하지만 런타임에는 없는 브라우저가 있다
  const permissions = navigator.permissions as Permissions | undefined
  if (permissions === undefined) return 'unknown'

  try {
    const status = await permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'unknown'
  }
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
