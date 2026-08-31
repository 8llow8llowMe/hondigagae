import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import type { PlanAlternativePlaceItem, PlanItemDetail } from '@/types/plan'

/**
 * 일정 상세의 순수 로직 — 일자 그룹핑 · 보강 대상 선별 · 거리 계산.
 *
 * **렌더와 분리한다.** 여기 담긴 규칙(어떤 항목이 장소인가, 어디서부터 잰 거리인가,
 * 기간 밖 항목이 무엇인가)은 전부 계약 해석이라 문자열 assertion 이 아니라 값으로
 * 검증해야 한다. 규칙 근거는 docs/features/plan/일정상세-세부명세.md D3.
 */

/**
 * `targetId` 가 `place.id` 를 가리키는 항목 유형.
 *
 * 백엔드 `PlanCommandProcessor.PLACE_TARGET_TYPES` 와 **같은 집합이어야 한다.**
 * `WALK` 의 `targetId` 는 `walk_course.id` 라 장소가 아니고 `MOVE` 는 대상이 없다 —
 * 이 둘을 `/places/{id}` 로 부르면 남의 id 로 404 를 만든다.
 */
const PLACE_TARGET_TYPES = new Set(['PLACE', 'MEAL', 'LODGING'])

const LODGING_TYPE = 'LODGING'

/** 장소 보강(`GET /places/{id}`) 대상인가 */
export function isPlaceTarget(item: PlanItemDetail): boolean {
  return PLACE_TARGET_TYPES.has(item.itemType.code) && item.targetId !== null
}

/**
 * 보강할 장소 id 목록. **중복을 제거한다** — 같은 장소를 두 일자에 담을 수 있고,
 * 그때 같은 요청을 두 번 보낼 이유가 없다.
 *
 * **실내 대안도 같은 목록에 넣는다** (#82 F1). `indoorAlternatives` 는
 * `{placeId, title}` 뿐이라 주소·실내 여부를 말하려면 똑같이 `GET /places/{id}` 가
 * 필요하다. 별도 `useQueries` 를 두면 **이미 항목으로 담긴 대안을 두 번 조회한다** —
 * 여기서 합쳐 중복을 없앤다.
 */
export function enrichTargetIds(
  items: PlanItemDetail[],
  alternatives: PlanAlternativePlaceItem[] = [],
): string[] {
  const ids = new Set<string>()
  for (const item of items) {
    if (isPlaceTarget(item) && item.targetId !== null) ids.add(item.targetId)
  }
  for (const alternative of alternatives) ids.add(alternative.placeId)
  return [...ids]
}

export type PlanDayGroup = {
  /** 1부터 */
  day: number
  items: PlanItemDetail[]
}

export type GroupedPlanItems = {
  /** `totalDays` 만큼 **항상** 만들어진다. 항목이 없는 일자도 섹션을 갖는다 */
  days: PlanDayGroup[]
  /**
   * `day > totalDays` 인 고아 항목. 기간을 줄여도 서버가 항목을 정리하지 않아 생긴다
   * (`PlanCommandProcessor.updatePlan`). **숨기지 않는다** — 숨기면 사용자가 자료가
   * 사라진 것을 모른다 (D4).
   */
  outOfRange: PlanItemDetail[]
}

/**
 * 항목을 일자별로 나눈다. 같은 일자 안은 `sequence` 오름차순이다.
 *
 * **`totalDays` 가 섹션 수를 정한다.** 항목 배열에서 유추하지 않는다 — 항목이 없는
 * 일자도 "이 날은 아직 담은 곳이 없어요" 를 보여줘야 한다.
 */
export function groupItemsByDay(items: PlanItemDetail[], totalDays: number): GroupedPlanItems {
  const safeTotal = Number.isInteger(totalDays) && totalDays > 0 ? totalDays : 0

  const days: PlanDayGroup[] = Array.from({ length: safeTotal }, (_, index) => ({
    day: index + 1,
    items: [],
  }))
  const outOfRange: PlanItemDetail[] = []

  for (const item of items) {
    const group = days[item.day - 1]
    // day 가 1 미만이거나 totalDays 를 넘으면 어느 섹션에도 속하지 않는다
    if (item.day >= 1 && group !== undefined) group.items.push(item)
    else outOfRange.push(item)
  }

  for (const group of days) group.items.sort(bySequence)
  outOfRange.sort((a, b) => (a.day === b.day ? bySequence(a, b) : a.day - b.day))

  return { days, outOfRange }
}

function bySequence(a: PlanItemDetail, b: PlanItemDetail): number {
  return a.sequence - b.sequence
}

/**
 * 그 일자의 출발점이 되는 숙소 항목 — **앞선 날의 숙소만이다.**
 *
 * 그날 밤을 보낸 곳이 다음 날 아침의 출발점이다. 세부명세 D3 은 "그날 또는 앞선 날" 로
 * 적었지만, **그날의 숙소를 기준으로 쓰면 아직 가지 않은 곳에서 출발한 것이 된다** —
 * 실렌더로 1일차 첫 항목에 `숙소에서 직선 14.8km` 가 붙었고, 그 숙소는 그날 저녁에
 * 체크인할 곳이었다.
 *
 * "그날" 을 넣어도 얻는 것이 없다. 숙소가 그날 첫 항목이면 자기 자신과의 거리(0km)라
 * 잡음이고, 둘째 항목부터는 **직전 항목 규칙이 이미 그 숙소를 기준으로 잡는다.**
 *
 * 앞선 날에 숙소가 없으면 `null` — 그때는 첫 항목에 거리 문구를 붙이지 않는다.
 */
export function lodgingBasisFor(day: number, days: PlanDayGroup[]): PlanItemDetail | null {
  // 가까운 앞선 날부터 거슬러 올라간다
  for (let previous = day - 1; previous >= 1; previous -= 1) {
    const group = days[previous - 1]
    const lodging = group === undefined ? undefined : lastLodging(group.items)
    if (lodging !== undefined) return lodging
  }

  return null
}

function lastLodging(items: PlanItemDetail[]): PlanItemDetail | undefined {
  return items.filter((item) => item.itemType.code === LODGING_TYPE).at(-1)
}

/** 거리 문구를 어떤 기준으로 말하는가. `null` 이면 거리를 렌더하지 않는다 */
export type PlanItemDistanceKind = 'lodging' | 'previous'

export type PlanItemRowModel = {
  item: PlanItemDetail
  /** 직선거리(m). 좌표가 한쪽이라도 없으면 `null` */
  distanceMeters: number | null
  distanceKind: PlanItemDistanceKind | null
}

/**
 * 한 일자의 항목들을 거리 정보와 함께 모델링한다.
 *
 * - 첫 항목 → 숙소 기준 (`숙소에서 직선 N km`). 숙소가 없거나 좌표가 없으면 문구 없음
 * - 2번째부터 → 직전 항목 기준 (`직선 N km 이동`)
 *
 * `coordOf` 는 보강 결과에서 좌표를 꺼내는 함수다. 아직 안 왔거나 실패했으면 `null` 을
 * 주면 되고, **그 행은 거리 없이 살아남는다** — 장소 조회 실패로 항목을 지우지 않는다.
 */
export function toItemRows(
  items: PlanItemDetail[],
  coordOf: (item: PlanItemDetail) => LatLng | null,
  lodgingBasis: PlanItemDetail | null,
): PlanItemRowModel[] {
  return items.map((item, index) => {
    const basis = index === 0 ? lodgingBasis : items[index - 1]
    const kind: PlanItemDistanceKind = index === 0 ? 'lodging' : 'previous'

    if (basis === undefined || basis === null) {
      return { item, distanceMeters: null, distanceKind: null }
    }

    const meters = haversineMeters(coordOf(basis), coordOf(item))
    // 좌표를 모르면 기준 자체를 말하지 않는다 — "숙소에서" 만 남으면 무슨 말인지 모른다
    return meters === null
      ? { item, distanceMeters: null, distanceKind: null }
      : { item, distanceMeters: meters, distanceKind: kind }
  })
}
