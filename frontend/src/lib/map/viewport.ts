import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'

/**
 * 지도 뷰포트 계산.
 *
 * SDK 객체를 받지 않고 **평범한 숫자만** 다룬다. 지도 코드에서 가장 틀리기 쉬운 부분이
 * 여기(경계 판정·반경 환산)인데 SDK 를 끼고 있으면 테스트를 쓸 수 없다.
 * 호출부가 `map.getBounds()` 를 이 형태로 옮겨 담아 넘긴다.
 */

/** 남서 / 북동 두 점으로 표현한 지도 영역 */
export type MapBounds = {
  sw: LatLng
  ne: LatLng
}

/**
 * 영역 안에 있는가.
 *
 * **경도 날짜변경선을 넘는 영역은 다루지 않는다.** 제주 전용 서비스라 `sw.lng > ne.lng`
 * 인 영역이 나올 수 없고, 일반화하면 판정이 복잡해져 오히려 틀린다.
 */
export function isWithinBounds(bounds: MapBounds, point: LatLng): boolean {
  return (
    point.lat >= bounds.sw.lat &&
    point.lat <= bounds.ne.lat &&
    point.lng >= bounds.sw.lng &&
    point.lng <= bounds.ne.lng
  )
}

/** 영역의 중심 */
export function boundsCenter(bounds: MapBounds): LatLng {
  return {
    lat: (bounds.sw.lat + bounds.ne.lat) / 2,
    lng: (bounds.sw.lng + bounds.ne.lng) / 2,
  }
}

/**
 * 영역을 감싸는 원의 반경(m).
 *
 * `GET /places/nearby` 는 사각형이 아니라 **중심 + 반경**을 받는다. 중심에서 모서리까지를
 * 반경으로 삼아야 화면에 보이는 영역이 조회 범위 안에 전부 들어온다 — 변의 절반을 쓰면
 * 네 모서리가 빠져 "지도에 보이는데 목록에 없는" 장소가 생긴다.
 *
 * `min` 을 두는 이유: 최대로 확대하면 반경이 수십 m 가 되어 아무것도 잡히지 않는다.
 * `max` 는 백엔드 `@Max(50_000)` 이다.
 */
export function boundsRadiusMeters(bounds: MapBounds, min = 300, max = 50_000): number {
  const corner = haversineMeters(boundsCenter(bounds), bounds.ne)
  if (corner === null) return min

  return Math.round(Math.min(max, Math.max(min, corner)))
}

/**
 * 두 영역이 실질적으로 같은가.
 *
 * "지도 이동 시 재검색" 이 켜져 있으면 `idle` 이벤트마다 재조회가 나가는데, 손가락이
 * 살짝 스친 정도(수 m)까지 재조회하면 요청이 폭주하고 목록이 계속 깜빡인다.
 * **중심 이동이 임계값 미만이면 같은 영역으로 본다.**
 */
export function isSameViewport(
  a: MapBounds | null,
  b: MapBounds | null,
  thresholdM = 200,
): boolean {
  if (a === null || b === null) return false

  const moved = haversineMeters(boundsCenter(a), boundsCenter(b))
  if (moved === null) return false
  if (moved >= thresholdM) return false

  // 중심이 그대로라도 확대·축소했으면 다른 영역이다
  const radiusA = boundsRadiusMeters(a)
  const radiusB = boundsRadiusMeters(b)
  const ratio = radiusA === 0 ? 1 : Math.abs(radiusA - radiusB) / radiusA

  return ratio < 0.1
}
