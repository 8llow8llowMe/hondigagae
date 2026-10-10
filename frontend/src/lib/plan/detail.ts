import { type LatLng, toLatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import type { PlanAlternativePlaceItem, PlanItemDetail } from '@/types/plan'

/**
 * 일정 상세의 순수 로직 — 일자 그룹핑 · 거리 계산 · 결손 판정.
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

/**
 * `targetId` 가 장소를 가리키는 항목인가.
 *
 * **더 이상 보강 대상 판정이 아니다** (#115). 항목의 장소 요약은 상세 응답이 함께
 * 주므로(`item.place`) 여기서 쓰는 곳은 **장소 링크를 걸어도 되는가**와 **`place` 가
 * 비었을 때 그것이 결손인가**를 가르는 자리다.
 */
export function isPlaceTarget(item: PlanItemDetail): boolean {
  return isPlaceTargetOf(item.itemType.code, item.targetId)
}

/**
 * 같은 판정을 **필드 두 개로** 묻는다 — 공유 열람 항목(`SharedPlanItem`)이 쓴다 (#628).
 *
 * `isPlaceTarget` 이 `PlanItemDetail` 을 받아서 공유 항목에 못 쓰는데, 호출부가 집합을
 * 복사하면 **백엔드가 유형을 늘렸을 때 한쪽만 고쳐진다.** 그 어긋남은 "공유 링크로
 * 열면 장소 링크만 안 걸린다" 로 나타나 눈에 잘 띄지 않는다.
 */
export function isPlaceTargetOf(itemTypeCode: string, targetId: string | null): boolean {
  return PLACE_TARGET_TYPES.has(itemTypeCode) && targetId !== null
}

/**
 * 장소를 가리키는데 그 요약이 오지 않은 항목.
 *
 * `place === null` 만으로는 판정할 수 없다 — **`WALK`·`MOVE` 도 `null` 이다.**
 * 장소를 가리키는 항목에서만 `null` 이 결손을 뜻한다.
 *
 * **원인을 단정하지 않는다.** 원천에서 사라졌을(delisted) 수도, tour-service 가
 * 일시 장애일 수도 있고 응답은 둘을 구분하지 않는다. 편집모드가 `PLAN_004` 후보를
 * 미리 짚는 데 쓰지만(E1) 문구는 "조회되지 않아요" 까지만 말한다.
 */
export function hasUnresolvedPlace(item: PlanItemDetail): boolean {
  return isPlaceTarget(item) && item.place === null
}

/**
 * 보강할 장소 id 목록 — **실내 대안 전용이다** (#82 F1).
 *
 * 항목은 여기 들어오지 않는다. `GET /plans/{planId}` 가 항목마다 `place` 를 함께
 * 주므로(#86) 항목당 `GET /places/{id}` 는 #115 에서 걷어냈다. 반면
 * `indoorAlternatives` 는 `{placeId, title, lat, lng, distanceMeters}` 뿐이라
 * 주소·실내 여부를 말하려면 여전히 조회가 필요하다.
 *
 * **중복을 제거한다** — 같은 장소가 두 일자의 대안일 수 있고, 그때 같은 요청을 두 번
 * 보낼 이유가 없다.
 */
export function alternativePlaceIds(alternatives: PlanAlternativePlaceItem[]): string[] {
  return [...new Set(alternatives.map((alternative) => alternative.placeId))]
}

export type PlanDayGroup<T extends DayPositioned = PlanItemDetail> = {
  /** 1부터 */
  day: number
  items: T[]
}

export type GroupedPlanItems<T extends DayPositioned = PlanItemDetail> = {
  /** `totalDays` 만큼 **항상** 만들어진다. 항목이 없는 일자도 섹션을 갖는다 */
  days: PlanDayGroup<T>[]
  /**
   * `day > totalDays` 인 고아 항목. 기간을 줄여도 서버가 항목을 정리하지 않아 생긴다
   * (`PlanCommandProcessor.updatePlan`). **숨기지 않는다** — 숨기면 사용자가 자료가
   * 사라진 것을 모른다 (D4).
   */
  outOfRange: T[]
}

/**
 * 일자 안에서 자리를 갖는 항목. **그룹핑에 필요한 최소 모양이다.**
 *
 * 소유자 상세(`PlanItemDetail`)와 공유 열람(`SharedPlanItem`)이 이 둘만 공유한다 —
 * 공유 응답에는 `planItemId`·`memo`·`visited` 가 없다 (#628).
 */
export type DayPositioned = { day: number; sequence: number }

/**
 * 항목을 일자별로 나눈다. 같은 일자 안은 `sequence` 오름차순이다.
 *
 * **`totalDays` 가 섹션 수를 정한다.** 항목 배열에서 유추하지 않는다 — 항목이 없는
 * 일자도 "이 날은 아직 담은 곳이 없어요" 를 보여줘야 한다.
 *
 * **제네릭인 이유** (#628): 공유 열람 화면이 같은 규칙을 쓴다. 여기 담긴 판단
 * (`totalDays` 가 섹션 수다 · 같은 일자는 `sequence` 순 · `day > totalDays` 는 고아)은
 * 소유자가 보든 링크로 받은 사람이 보든 같아야 하는데, 복사해 두면 **한쪽만 고쳐지는
 * 날**이 온다. 기존 호출부는 추론으로 그대로 통과한다.
 */
export function groupItemsByDay<T extends DayPositioned>(
  items: T[],
  totalDays: number,
): GroupedPlanItems<T> {
  const safeTotal = Number.isInteger(totalDays) && totalDays > 0 ? totalDays : 0

  const days: PlanDayGroup<T>[] = Array.from({ length: safeTotal }, (_, index) => ({
    day: index + 1,
    items: [],
  }))
  const outOfRange: T[] = []

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

function bySequence(a: DayPositioned, b: DayPositioned): number {
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
 * **좌표는 항목이 직접 들고 온다** (`item.place.lat/lng`, #86). 예전에는 호출부가
 * 보강 결과 맵을 `coordOf` 로 넘겼는데, 이제 상세 응답 안에 있으므로 주입할 것이 없다.
 *
 * `place` 가 비었거나 좌표가 없으면 **그 행은 거리 없이 살아남는다** — 장소 요약이
 * 없다고 항목을 지우지 않는다 (공통명세 S8).
 */
export function toItemRows(
  items: PlanItemDetail[],
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

/** 항목의 좌표. `place` 가 없거나 좌표가 비면 `null` 이고 그 행은 거리를 갖지 않는다 */
function coordOf(item: PlanItemDetail): LatLng | null {
  return item.place === null ? null : toLatLng(item.place)
}

/**
 * 지도에 찍을 좌표 — **`coordOf` 보다 넓다** (#743).
 *
 * 거리 줄은 `place` 만 본다. 올레 항목(`WALK`)의 `place` 는 항상 `null` 이고 좌표는
 * `walkCourse` 에 코스 **시작점**으로 들어 있는데, 그 한 점으로 잰 거리는 "코스까지의
 * 거리" 도 "코스를 걸은 거리" 도 아니라 숫자로 말하기 어렵다.
 *
 * **지도는 다르다.** 그 시작점을 찍는 것은 "이 코스가 이 근처다" 라는 참말이고, 올레를
 * 담은 일정에서 그 항목만 지도에 없으면 그것이 결함으로 읽힌다. 그래서 여기서만
 * `walkCourse` 를 함께 본다.
 *
 * 둘이 갈리는 것을 기록으로 남긴다 — 나중에 거리 줄에 `walkCourse` 를 더하려는 사람은
 * 위 문단의 "숫자로 말하기 어렵다" 를 먼저 풀어야 한다.
 *
 * **코스 대부분은 좌표가 없다.** [#722](https://github.com/8llow8llowMe/hondigagae/issues/722)
 * 가 "29개 중 25개가 좌표 없이 적재돼 있다" 고 적는다 — 결손 고지(`routeOmitted`)가
 * 장식이 아니라 실제로 자주 걸리는 줄이라는 뜻이다.
 */
export function planItemMapCoord(item: PlanItemDetail): LatLng | null {
  const place = coordOf(item)
  if (place !== null) return place

  return item.walkCourse === null ? null : toLatLng(item.walkCourse)
}
