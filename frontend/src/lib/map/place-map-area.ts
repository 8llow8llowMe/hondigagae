import { type LatLng, toLatLng } from '@/lib/geo/coord'
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
 * 기준점이 있는 지도(담기, #1177)가 **처음 찾는 범위** — 기준점에서 네 변까지의 거리(m).
 *
 * **5km 다.** 차로 10분 안팎 — 하루 동선에서 "다음에 들를 곳" 을 고르는 거리이고, 중문에서
 * 서귀포 시내(약 14km)는 들지 않지만 중문·대포·색달은 든다. 주변 조회는 모서리까지를 반경으로
 * 보내므로(`boundsRadiusMeters`) 실제 반경은 약 7.1km 다. 더 넓히면 제주 지도 절반이 들어와
 * 기준점을 둔 의미가 흐려지고, 좁히면 한적한 동네에서 결과가 비어 첫 화면이 빈 상태로 열린다.
 * 그 너머는 사용자가 지도를 옮겨 "이 지역에서 재검색" 으로 넓힌다 — `/places` 와 같은 길이다.
 */
export const PLACE_MAP_FOCUS_RADIUS_METERS = 5_000

/** 위도 1도의 남북 거리(m). `viewport.ts` 와 같은 값 — 제주만 다루므로 상수로 충분하다 */
const METERS_PER_LAT_DEGREE = 111_320

/**
 * 기준점에서 시작하는 영역 — **"이 지역에서 재검색" 을 이미 누른 모양**이다 (#1177).
 *
 * 그래서 첫 목록이 프리페치한 `/places` 첫 장(`placeId` 순 — 한경면부터다)이 아니라 이 자리의
 * 주변 조회(`/places/nearby`, 서버 거리순)다. 권유 기준도 같은 자리에서 시작하지만, 카메라가
 * 놓은 실제 시야로 곧 옮겨 간다 (`areaAfterFramedIdle`).
 *
 * 영역은 정사각형이다 — `/places` 의 재검색이 화면 사각형을 그대로 쓰는 것과 같은 모양이다.
 */
export function focusedPlaceMapArea(focus: LatLng): PlaceMapArea {
  const dLat = PLACE_MAP_FOCUS_RADIUS_METERS / METERS_PER_LAT_DEGREE
  const dLng =
    PLACE_MAP_FOCUS_RADIUS_METERS / (METERS_PER_LAT_DEGREE * Math.cos((focus.lat * Math.PI) / 180))

  return areaAfterResearch({
    sw: { lat: focus.lat - dLat, lng: focus.lng - dLng },
    ne: { lat: focus.lat + dLat, lng: focus.lng + dLng },
  })
}

/**
 * 기준점 지도의 카메라가 어디까지 왔나 (#1177).
 *
 * - `pending` — 지도는 떴지만 카메라를 아직 놓지 않았다. 이때의 `idle` 은 **제주 기본 시야**다
 * - `applied` — 카메라를 놓았다(`MapCanvas` 의 `onCameraApplied`). 다음 `idle` 이 그 결과다
 * - `settled` — 그 `idle` 을 받았다. 이제부터는 `/places` 와 같다
 */
export type FocusFraming = 'pending' | 'applied' | 'settled'

/**
 * 기준점 지도의 `idle` 을 어떻게 받을지.
 *
 * **함정이 있다.** 지도는 먼저 제주 기본 위치로 만들어지고(`MapCanvas` 는 첫 중심을 생성 전에
 * 정한다), 카메라가 그 뒤에 한 번 옮긴다. 첫 `idle`(`userMoved=false`)을 `areaAfterIdle` 로
 * 받으면 권유 기준이 제주 기본 시야로 덮이고, 카메라가 기준점으로 옮기는 순간 "충분히
 * 벗어났다" 로 읽혀 **조작 0회에서 재검색 버튼이 뜬다.** 카메라의 `idle` 은 `settledRef` 가 이미
 * 켜진 뒤라 `userMoved=true` 로 와서 `userMoved` 로는 가를 수 없다.
 *
 * 그래서 카메라를 놓기 전의 `idle` 은 **보지도 않고**(`seen: false` — 보이는 영역 `bounds` 도
 * 옮기지 않는다. 옮기면 그 사이 버튼이 한 번 깜빡인다), 놓은 뒤 첫 `idle` 을 권유 기준으로 삼는다
 * (`adoptOrigin`). 기준을 기준점 사각형으로 두지 않는 이유: 카메라는 단계가 정수라 사각형보다
 * 넓게 보이고 기준점을 화면 위쪽에 둬 중심도 다르다 — 그 차이가 그대로 확대·이동으로 읽힌다.
 */
export function framingAfterIdle(framing: FocusFraming): {
  framing: FocusFraming
  /** 이 `idle` 의 영역을 지금 보이는 영역(`bounds`)으로 받는가 */
  seen: boolean
  /** 이 `idle` 의 영역을 재검색 권유 기준으로 삼는가 (`areaAfterFramedIdle`) */
  adoptOrigin: boolean
} {
  if (framing === 'pending') return { framing, seen: false, adoptOrigin: false }
  if (framing === 'applied') return { framing: 'settled', seen: true, adoptOrigin: true }
  return { framing, seen: true, adoptOrigin: false }
}

/**
 * 카메라가 놓은 시야를 **권유 기준으로만** 삼는다 (#1177).
 *
 * 목록 영역(`searched`)은 기준점 사각형 그대로다 — 옮기면 주변 조회 키(중심·반경)가 바뀌어
 * 같은 자리를 한 번 더 조회한다. 대가는 캡션이 "목록 N곳" 인 것뿐이다(`isSameViewport` 가 두
 * 영역을 다르다고 본다). 목록의 장소는 모두 기준점 사각형 안이라 거짓말은 아니다.
 */
export function areaAfterFramedIdle(area: PlaceMapArea, next: MapBounds): PlaceMapArea {
  return { ...area, origin: next }
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
