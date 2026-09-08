/** 카카오 지도에 넘길 좌표. 카카오는 LatLng(위도, 경도) 순서다 */
export type LatLng = { lat: number; lng: number }

/**
 * 지도 첫 화면의 **기준 해안선** — 제주시 북쪽 해안(제주항 부근)이다.
 *
 * **중심 좌표가 아니다.** 이 위도가 화면 위쪽 `JEJU_MAP_SEA_RATIO` 지점에 오도록
 * 중심을 역산한다 (`framedCenterLat`, `lib/map/viewport.ts`). 그래야 어느 뷰포트에서든
 * 위쪽은 바다, 아래쪽은 육지로 열린다 — 섬의 기하 중심(한라산)에 놓으면 화면 사방이
 * 바다로 둘러싸여 "어디를 보는 지도인지" 가 읽히지 않았다.
 *
 * 조회 기준점(`lib/geo/current-position.ts` 의 `JEJU_QUERY_CENTER`, 제주시청 부근)과
 * **다른 값이고 쓰임도 다르다.** 이쪽은 **지도를 어디에 놓을지**, 저쪽은 좌표가 없을 때
 * **무엇을 조회할지**의 기준이다. 이름에 `MAP` / `QUERY` 를 남겨 둔 이유가 그것이다 —
 * 예전에 둘 다 "CENTER" 였을 때 지도(#14)가 조회 기준점을 집어 첫 화면이 비었다.
 */
export const JEJU_MAP_ANCHOR: LatLng = { lat: 33.52, lng: 126.5312 }

/**
 * 첫 화면에서 **위쪽 몇 할이 바다인가.**
 *
 * 해안선을 화면 정중앙에 두면 육지와 바다가 반반이라 목록에 담긴 장소의 절반 이상이
 * 화면 아래 좁은 띠에 몰린다. 위쪽 35% 만 바다로 남기면 시선이 육지에서 시작한다.
 */
export const JEJU_MAP_SEA_RATIO = 0.35

/**
 * 지도 첫 확대 단계. 카카오는 **작을수록 확대**다.
 *
 * 9 는 1280px 폭에서 섬의 동서 폭(약 73km)이 꼭 맞게 들어오는 값이다. 10 이었을 때는
 * 섬 좌우로 빈 바다가 절반씩 남아 마커가 가운데 뭉쳐 보였다.
 *
 * **8 로 더 내리지 않는다.** 8 이면 폭이 절반(약 37km)이라 첫 화면에서 서귀포가 통째로
 * 빠진다 — "제주 여행" 을 설계하러 온 화면이 제주시만 보여 주면 안 된다.
 * 7 은 반경 11km 라 한라산만 보이고 첫 화면에 장소가 하나도 없다 (실측).
 *
 * 픽셀당 미터는 `metersPerPixel`(`lib/map/viewport.ts`) 이 이 단계에서 환산한다.
 */
export const JEJU_MAP_LEVEL = 9

/**
 * 목록에서 **한 곳을 고를 때** 맞추는 확대 단계.
 *
 * 4 m/px — 데스크톱 1280 폭에서 약 5km, 모바일 375 폭에서 약 1.5km 다. 장소와 주변
 * 상가·해안이 함께 보이는 범위다.
 *
 * **더 내리지 않는다.** 왼쪽 목록은 "지도에 보이는 곳" 이라서 영역이 좁아지면 목록도
 * 같이 줄어든다. 4(폭 2.6km)로 내리면 카드 하나를 누른 순간 목록이 한두 건으로 남아
 * **다음 카드를 이어 누를 수가 없다.** 5 는 다른 핀 몇 개가 화면에 남는다.
 *
 * 첫 화면 단계(`JEJU_MAP_LEVEL`)와 **다른 값이고 쓰임도 다르다.** 저쪽은 섬을 보여 주고,
 * 이쪽은 한 곳을 보여 준다.
 */
export const SELECTED_PLACE_MAP_LEVEL = 5

/**
 * 응답 좌표를 지도에 쓸 수 있는 형태로 변환한다.
 *
 * 백엔드는 lat / lng 를 Double 로 내려주지만 null 이거나 0 인 장소가 있다.
 * 그런 장소를 그대로 마커로 그리면 지도가 기니 만(0,0) 으로 튄다.
 * 좌표가 유효하지 않으면 null 을 반환하고, 호출부가 마커를 그리지 않는다.
 */
export function toLatLng(source: {
  lat: number | null | undefined
  lng: number | null | undefined
}): LatLng | null {
  const { lat, lng } = source

  if (!isValidCoordinate(lat, -90, 90)) return null
  if (!isValidCoordinate(lng, -180, 180)) return null

  return { lat, lng }
}

function isValidCoordinate(
  value: number | null | undefined,
  min: number,
  max: number,
): value is number {
  if (typeof value !== 'number') return false
  if (!Number.isFinite(value)) return false
  // 0 은 좌표 미상을 뜻하는 값으로 취급한다 (제주 데이터에 실제 0 좌표는 없다)
  if (value === 0) return false
  return value >= min && value <= max
}
