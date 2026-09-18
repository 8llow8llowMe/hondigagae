import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters, isLongTrip } from '@/lib/geo/distance'

/**
 * 동선 모델 — 항목 배열을 **핀과 선**으로 옮긴다.
 *
 * **항목 타입에 의존하지 않는다.** 일정 상세(`PlanItemDetail`)와 AI 초안
 * (`AiPlanScheduleItem`)은 `itemType` 의 모양도 좌표를 얻는 경로도 다르지만 **규칙은
 * 같다** — `lib/plan/item-distance` 가 거리 줄에 내린 결정과 같은 이유다. 규칙을 여기
 * 두고 접근자는 호출부가 맞춰 넣는다.
 *
 * 규칙 정본: `docs/features/plan/동선지도-세부명세.md` D2-1.
 *
 * **순수 함수라 값으로 테스트된다.** 지도 코드에서 눈으로 확인하기 가장 어려운 부분이고,
 * 좌표 결손·순번·합계는 브라우저에서 보면 이미 늦다.
 */

/** 대상이 없는 항목 유형. 좌표가 없어도 **결손이 아니다** */
const MOVE_TYPE = 'MOVE'

/**
 * 한 일자의 항목 하나. **좌표는 호출부가 뽑아서 넣는다** — 일정 상세는
 * `place ?? walkCourse`, 초안은 보강 맵(`coords`)에서 온다.
 */
export type RouteItemInput = {
  /** `planItemId` 또는 `placeId`. 목록 행과 지도를 잇는 열쇠다 */
  id: string
  /** 서버 enum 의 `code` 또는 초안의 raw 문자열 */
  itemTypeCode: string
  title: string
  coord: LatLng | null
}

export type RouteStop = {
  id: string
  /**
   * 화면 순번. **`sequence` 가 아니라 좌표가 있는 항목만 센 번호다.**
   *
   * 결손을 건너뛰고도 `sequence` 를 쓰면 핀이 `1, 2, 4` 로 튄다. 사용자는 "3번이 어디
   * 갔나" 를 묻게 되고, 그 답은 지도가 아니라 결손 고지 줄이 한다 (명세 D5).
   */
  order: number
  title: string
  coord: LatLng
}

export type RouteLeg = {
  fromId: string
  toId: string
  from: LatLng
  to: LatLng
  /** 직선거리(m) */
  straightMeters: number
  /** **앞선 날의 숙소**에서 들어오는 구간인가. 오늘의 이동이 아니다 */
  fromLodging: boolean
  /** `LONG_TRIP_THRESHOLD_M`(30km) 이상인가. 행의 경고 톤과 **같은 임계값**이다 */
  long: boolean
}

export type RouteModel = {
  stops: RouteStop[]
  /** `stops.length - 1` 개. 숙소 진입이 있으면 하나 더 앞에 붙는다 */
  legs: RouteLeg[]
  /**
   * 좌표가 없어 지도에서 빠진 항목 수. **`MOVE` 는 세지 않는다** — 그 항목은 원래
   * 가리킬 자리가 없고, 세면 고지 줄이 이동 항목을 쓰는 일정마다 떠 있는 장식이 된다.
   */
  omittedCount: number
  /**
   * 직선 합계(m). **숙소 진입 구간을 포함하지 않는다** — 그날 움직인 거리를 말해야
   * 하고, 넣으면 같은 일정을 1일차부터 읽어 내려갈 때 합계가 이유 없이 뛴다.
   */
  totalStraightMeters: number
}

export function toRouteModel(input: {
  items: readonly RouteItemInput[]
  /**
   * 앞선 날의 마지막 숙소. `lib/plan/detail.ts` 의 `lodgingBasisFor` 가 정한다 —
   * **여기서 다시 찾지 않는다.** 거리 줄과 지도가 같은 기준을 써야 숫자와 그림이
   * 같은 말을 한다.
   */
  lodgingBasis: RouteItemInput | null
}): RouteModel {
  const stops: RouteStop[] = []
  let omittedCount = 0

  for (const item of input.items) {
    if (item.coord === null) {
      if (item.itemTypeCode !== MOVE_TYPE) omittedCount += 1
      continue
    }

    stops.push({ id: item.id, order: stops.length + 1, title: item.title, coord: item.coord })
  }

  const legs: RouteLeg[] = []

  const basis = input.lodgingBasis
  const first = stops[0]
  if (basis !== null && basis.coord !== null && first !== undefined) {
    legs.push(makeLeg(basis.id, basis.coord, first.id, first.coord, true))
  }

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]
    const current = stops[index]
    if (previous === undefined || current === undefined) continue

    legs.push(makeLeg(previous.id, previous.coord, current.id, current.coord, false))
  }

  return {
    stops,
    legs,
    omittedCount,
    totalStraightMeters: legs
      .filter((leg) => !leg.fromLodging)
      .reduce((total, leg) => total + leg.straightMeters, 0),
  }
}

function makeLeg(
  fromId: string,
  from: LatLng,
  toId: string,
  to: LatLng,
  fromLodging: boolean,
): RouteLeg {
  // 두 좌표가 모두 있으므로 null 이 나올 수 없다. 방어값은 0 이 아니라 그대로 두고,
  // 0 이 나오면 같은 자리라는 뜻이라 긴 이동 판정도 자연히 false 다
  const straightMeters = haversineMeters(from, to) ?? 0

  return { fromId, toId, from, to, straightMeters, fromLodging, long: isLongTrip(straightMeters) }
}

/**
 * 지도에 그릴 선 한 토막.
 *
 * **색으로 가르지 않는다.** 하나의 선색(`--brand-500`)에 굵기와 패턴만 달리한다 —
 * 마커에 판정 색을 쓰지 않는다는 규칙(`DESIGN.md`)이 선에도 그대로 적용된다.
 */
export type MapRouteSegment = {
  path: LatLng[]
  tone: 'default' | 'dashed' | 'emphasis'
}

/**
 * 구간마다 선 하나.
 *
 * **숙소 진입은 길어도 `dashed` 다.** 그 구간은 오늘의 이동이 아니라 어제와 오늘의
 * 이음매이고, 거리는 행의 `숙소에서 직선 N km` 가 이미 말한다. 톤 하나에 두 가지 뜻을
 * 겹치면 굵은 점선이 무엇을 말하는지 읽을 수 없다.
 */
export function toRouteSegments(legs: readonly RouteLeg[]): MapRouteSegment[] {
  return legs.map((leg) => ({
    path: [leg.from, leg.to],
    tone: leg.fromLodging ? 'dashed' : leg.long ? 'emphasis' : 'default',
  }))
}

/** 위도 1도의 거리(m). 경도는 위도에 따라 줄어들어 `cos` 을 곱한다 */
const METERS_PER_DEGREE = 111_320

/**
 * 정류점 하나짜리 일자에서 쓰는 폭(m). **`PlaceMiniMap` 과 같은 값이다** — 답해야 하는
 * 질문("여기가 어디쯤")이 그때는 같아진다.
 */
const SINGLE_STOP_SPAN_METERS = 1200

/**
 * 정류점을 다 담는 폭. 가장자리 핀의 이름표가 잘리지 않도록 여유를 준다.
 *
 * 1.0 이면 양 끝 핀이 화면 경계에 정확히 걸리는데, 핀은 이름표가 있어 좌표보다 가로로
 * 넓다 (`.map-pin` `max-width: 180px`).
 */
const SPAN_PADDING = 1.4

/**
 * 정류점을 담는 카메라. `MapCanvas` 의 `camera` prop 에 그대로 넘긴다.
 *
 * **호출부는 반드시 `useMemo` 로 감싼다.** 렌더 중에 새 객체를 만들면 참조가 매번 바뀌어
 * 일자 칩을 누를 때마다 카메라가 되돌아간다 (`PlaceMiniMap` · `use-emergency-board.ts` 가
 * 같은 함정을 같은 방법으로 막는다).
 */
export function routeCamera(
  stops: readonly RouteStop[],
): { anchor: LatLng; spanMeters: number } | null {
  const first = stops[0]
  if (first === undefined) return null

  let minLat = first.coord.lat
  let maxLat = first.coord.lat
  let minLng = first.coord.lng
  let maxLng = first.coord.lng

  for (const stop of stops) {
    minLat = Math.min(minLat, stop.coord.lat)
    maxLat = Math.max(maxLat, stop.coord.lat)
    minLng = Math.min(minLng, stop.coord.lng)
    maxLng = Math.max(maxLng, stop.coord.lng)
  }

  const anchor = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }

  const latMeters = (maxLat - minLat) * METERS_PER_DEGREE
  const lngMeters = (maxLng - minLng) * METERS_PER_DEGREE * Math.cos((anchor.lat * Math.PI) / 180)

  /*
    **긴 변을 담는다.** `framedCamera` 가 컨테이너의 **짧은 변** 기준으로 단계를 역산하므로
    (`levelForSpanMeters`), 여기서 짧은 변을 넘기면 긴 쪽이 화면 밖으로 나간다.

    정류점이 하나면 두 변이 모두 0 이라 최솟값으로 떨어진다 — 0 을 그대로 넘기면 SDK 가
    최대 배율로 확대해 아무것도 보이지 않는다.
  */
  return {
    anchor,
    spanMeters: Math.max(Math.max(latMeters, lngMeters) * SPAN_PADDING, SINGLE_STOP_SPAN_METERS),
  }
}
