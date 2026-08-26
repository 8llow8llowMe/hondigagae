/** 카카오 지도에 넘길 좌표. 카카오는 LatLng(위도, 경도) 순서다 */
export type LatLng = { lat: number; lng: number }

/** 제주 중심 — 좌표를 얻지 못했을 때의 폴백 */
export const JEJU_CENTER: LatLng = { lat: 33.3846, lng: 126.5535 }

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
