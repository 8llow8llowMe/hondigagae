import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import { boundsCenter, type MapBounds } from '@/lib/map/viewport'

/**
 * 지금 보고 있는 자리가 **조회한 자리에서 충분히 벗어났는가** — 이슈 #396.
 *
 * `/places` 는 지도를 옮기면 스스로 재조회하지만 이 화면은 그러지 않는다. 재조회하면
 * `distanceMeters` 가 지도 중심 기준이 되어 "가까운 순 · 480m" 이 거짓이 되기 때문이다
 * (PR #373). 그래서 **재조회 시점을 사용자가 쥔다** — 버튼을 띄우고, 누를 때만 옮긴다.
 *
 * **임계값이 반경에 비례한다.** 반경 1km 를 보다가 300m 옮긴 것과 반경 40km 를 보다가
 * 300m 옮긴 것은 전혀 다른 일이다. 고정 미터로 두면 넓은 반경에서 손만 스쳐도 버튼이
 * 뜨고, 좁은 반경에서는 화면 밖으로 나가도 안 뜬다.
 *
 * `0.3` 은 **조회 범위의 30% 를 벗어난 지점**이다. 그보다 작으면 지금 목록이 여전히 그
 * 자리를 충분히 덮고 있어 재조회할 이유가 없다.
 */
export const RESEARCH_OFFER_RATIO = 0.3

export function shouldOfferResearch(params: {
  /** 지금 지도가 보여주는 영역. 첫 `idle` 전이면 null */
  bounds: MapBounds | null
  /** 지금 목록이 조회된 기준점. 좌표를 아직 못 받았으면 null */
  anchor: LatLng | null
  /** 조회 반경(m) */
  radius: number
  /**
   * 시설을 고른 상태인가.
   *
   * **고른 동안에는 띄우지 않는다.** 선택은 지도를 도로 단계까지 확대시키므로
   * (`SELECTED_FACILITY_MAP_LEVEL`) 중심이 그만큼 옮겨 가는데, 그것은 사용자가 "다른
   * 지역을 보겠다" 고 한 것이 아니라 우리가 확대한 결과다. 그 자리에 버튼이 뜨면
   * 고를 때마다 재조회를 권하는 꼴이 된다.
   */
  selected: boolean
}): boolean {
  const { bounds, anchor, radius, selected } = params

  if (selected || bounds === null || anchor === null) return false
  if (!Number.isFinite(radius) || radius <= 0) return false

  const moved = haversineMeters(anchor, boundsCenter(bounds))
  if (moved === null) return false

  return moved > radius * RESEARCH_OFFER_RATIO
}
