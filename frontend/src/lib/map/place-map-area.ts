import { toLatLng } from '@/lib/geo/coord'
import { isWithinBounds, type MapBounds } from '@/lib/map/viewport'

/**
 * `/places` 지도 보기가 쥐는 **두 영역** — 이슈 #1143.
 *
 * 둘은 예전에 `searchedBounds` 하나였다. 첫 `idle` 이 그것을 채워 목록 영역 필터를 켰는데,
 * 서버 렌더·첫 페인트에는 영역이 없어 프리페치한 첫 페이지가 전부 행으로 서 있다가
 * **SDK 가 뜨는 순간 지도 밖 장소가 빠지며 아래 행이 당겨졌다** — Lighthouse 모바일 CLS
 * 0.159, 범인 요소가 시트 행(`place-map-panel.tsx` 의 `li`)이었다. 모바일은 첫 화면
 * 레벨 9 에서 폭 약 24km 만 보여 대거 빠진다.
 *
 * 그래서 하던 일 둘을 가른다.
 *  - `origin` — **재검색 권유의 기준.** 첫 `idle` 에 놓인다. "여기서 충분히 벗어났나" 를
 *    재려면 처음부터 자가 있어야 한다 (`shouldOfferResearch`).
 *  - `searched` — **목록·핀 영역 필터와 주변 조회의 자리.** 재검색 버튼만 놓는다. 그 전에는
 *    `null` 이라 목록이 서버가 그린 그대로 남는다.
 *
 * 대가는 첫 화면 캡션이다 — 지도 밖 장소도 목록에 남으므로 "지도에 보이는 N곳" 이 아니라
 * "목록 N곳" 이 맞다 (`visibleCountLabel` 의 기존 갈래, `isSameViewport` 가 `null` 이면
 * `false`).
 */
export type PlaceMapArea = {
  /** 재검색 권유의 기준 영역. 첫 `idle` 전이면 null */
  origin: MapBounds | null
  /** 목록이 세는 영역이자 주변 조회의 자리. 재검색 전이면 null — 거르지 않는다 */
  searched: MapBounds | null
}

export const INITIAL_PLACE_MAP_AREA: PlaceMapArea = { origin: null, searched: null }

/**
 * 지도가 멈췄다(`idle`).
 *
 * **첫 `idle`(`userMoved === false`)만 권유 기준을 놓는다.** 그 뒤의 `idle` 은 어느 영역도
 * 옮기지 않는다 — 팬·줌·선택-확대가 목록을 흔들지 않는 것이 #396 의 규칙이다. 지금 보이는
 * 영역은 호출부가 `bounds` 로 따로 들고 있다.
 *
 * 바뀐 것이 없으면 **같은 객체를 돌려준다** — `setState` 가 리렌더를 건너뛴다.
 */
export function areaAfterIdle(
  area: PlaceMapArea,
  next: MapBounds,
  userMoved: boolean,
): PlaceMapArea {
  if (userMoved) return area

  return { ...area, origin: next }
}

/**
 * "이 지역에서 재검색" — 누른 자리가 **권유 기준이자 목록 영역**이 된다.
 *
 * 둘을 같이 옮겨야 누른 직후 버튼이 사라진다. 권유 기준만 옛 자리에 두면 방금 누른
 * 자리에서 다시 "벗어났다" 고 판정한다.
 */
export function areaAfterResearch(bounds: MapBounds): PlaceMapArea {
  return { origin: bounds, searched: bounds }
}

/**
 * 목록 영역 안에 든 장소만 남긴다.
 *
 * **영역이 없으면 같은 배열을 그대로 돌려준다** — 재검색 전에는 거르지 않는다는 뜻이고,
 * 참조가 같아야 아래 핀 배열 `useMemo` 가 괜히 새로 서지 않는다.
 *
 * 좌표가 없는 곳은 지도가 판단할 수 없다. 숨기지 않고 남긴다 — 목록으로도 같은 정보에
 * 도달할 수 있어야 한다 (이슈 #14 완료 조건).
 */
export function placesInArea<T extends { lat: number | null; lng: number | null }>(
  places: T[],
  searched: MapBounds | null,
): T[] {
  if (searched === null) return places

  return places.filter((place) => {
    const coord = toLatLng(place)
    return coord === null || isWithinBounds(searched, coord)
  })
}
