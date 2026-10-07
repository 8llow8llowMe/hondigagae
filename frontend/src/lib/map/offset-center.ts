/** 화면 픽셀 오프셋. `x` 는 오른쪽, `y` 는 아래쪽이 양수다 */
export type MapOffset = { x: number; y: number }

type LatLngLike = { getLat: () => number; getLng: () => number }
type PointLike = { x: number; y: number }

/**
 * 목표가 **화면 중심 + `offset`** 에 오게 하는 새 중심 (#1227). 오프셋이 없으면 `null` — 목표 그대로다.
 *
 * 지도 위에 표면이 떠 있으면 정중앙이 그 표면 아래일 수 있다 — 1440 에서 목록(400)과 미리보기(400)가
 * 왼쪽 850px 남짓을 덮어, 정중앙(720)으로 옮긴 핀이 미리보기 뒤에 숨었다. 목표가 화면점 `p` 에 있을 때
 * 중심을 `p − offset` 으로 옮기면 목표는 `중심 + offset` 에 선다.
 *
 * **지금 단계의 투영으로 재고 `scale` 로 최종 단계에 맞춘다.** 확대 애니메이션이 끝난 뒤에 투영을
 * 읽으면 맞을 것 같지만, 예약 시점이 마지막 프레임보다 먼저 올 수 있고 숨겨진 탭에서는 애니메이션이
 * 아예 멈춘다 — 그때 이전 단계 배율로 재면 9 → 5 에서 16배가 틀어져 핀이 화면 밖으로 나간다.
 * 카카오 단계는 한 칸마다 배율이 두 배라, 같은 픽셀 거리의 좌표 차이는 `2^(최종 − 지금)` 배가 된다.
 * 그래서 타이밍에 기대지 않는다. (메르카토르 비선형은 이 거리 · 제주 위도에서 무시할 만하다.)
 */
export function offsetCenter(params: {
  projection: {
    containerPointFromCoords: (latlng: LatLngLike) => PointLike
    coordsFromContainerPoint: (point: PointLike) => LatLngLike
  }
  /** SDK 의 `new maps.Point(x, y)` — 투영이 SDK 객체를 요구한다 */
  point: (x: number, y: number) => PointLike
  target: LatLngLike
  offset: MapOffset | null
  /** `2^(최종 단계 − 지금 단계)`. 확대 없이 옮기면 1 */
  scale: number
}): { lat: number; lng: number } | null {
  const { projection, point, target, offset, scale } = params
  if (offset === null || (offset.x === 0 && offset.y === 0)) return null

  const at = projection.containerPointFromCoords(target)
  const moved = projection.coordsFromContainerPoint(point(at.x - offset.x, at.y - offset.y))

  return {
    lat: target.getLat() + (moved.getLat() - target.getLat()) * scale,
    lng: target.getLng() + (moved.getLng() - target.getLng()) * scale,
  }
}
