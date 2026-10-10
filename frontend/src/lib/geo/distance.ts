import type { LatLng } from '@/lib/geo/coord'

/**
 * 두 좌표 사이 거리.
 *
 * **서버에 거리 필드가 없어서 화면이 계산한다.** 일정 항목은 `PlanItemDetail` 에
 * 좌표가 없고 장소 보강(`GET /places/{id}`)으로 따라오므로, 그것을 받은 뒤에 잰다.
 *
 * **이것은 직선거리다.** 제주는 산간·해안도로가 많아 주행거리와 크게 다르다 —
 * 화면 문구가 반드시 "직선" 을 밝힌다 (일정상세-세부명세 D3).
 */

/** 지구 평균 반지름(m). WGS84 평균 반지름 */
const EARTH_RADIUS_M = 6_371_008.8

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * 하버사인 직선거리(m).
 *
 * **한쪽이라도 좌표가 없으면 `null` 이다.** `0` 을 쓰지 않는다 — 0m 는 "같은 자리" 라는
 * 뜻이라 "모른다" 와 전혀 다르고, 화면이 `0m 이동` 이라고 거짓말하게 된다.
 */
export function haversineMeters(from: LatLng | null, to: LatLng | null): number | null {
  if (from === null || to === null) return null

  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(fromLat) * Math.cos(toLat)

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * 긴 이동 임계값(m). 넘으면 그 행에 경고 톤이 붙는다.
 *
 * 30km 다 — 아트보드 01 이 41.2km 구간을 "하루 이동이 깁니다" 로 본다.
 * **별도 경고 배지를 만들지 않는다.** 행 자체가 경고를 말하는 것이 편집 동기를 만든다.
 */
export const LONG_TRIP_THRESHOLD_M = 30_000

/** 임계값 이상인가. **`>=` 다** — 정확히 30km 도 긴 이동으로 본다 */
export function isLongTrip(meters: number | null): boolean {
  return meters !== null && meters >= LONG_TRIP_THRESHOLD_M
}
