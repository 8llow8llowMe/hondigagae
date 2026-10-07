import type { LatLng } from '@/lib/geo/coord'
import { itemInsertIndex } from '@/lib/plan/day-items'
import {
  groupItemsByDay,
  lodgingBasisFor,
  type PlanDayGroup,
  planItemMapCoord,
} from '@/lib/plan/detail'
import type { PlanDetail } from '@/types/plan'

/**
 * 담기 지도를 **어디서 열지** — 이슈 #1177.
 *
 * 지도 첫 화면이 그날 장소와 무관하게 제주시(`JEJU_MAP_ANCHOR`)로 열렸다. 2026-10-06 dev
 * 실데이터 사용성 점검에서 중문·서귀포를 도는 날을 열었는데 패널 첫 항목이 한경면이었다 —
 * `GET /places` 는 좌표·정렬 파라미터가 없어 `placeId` 순이다.
 *
 * **"다음에 갈 곳" 을 고르는 화면이라 직전에 들른 곳이 기준이다.** 순서는 이렇다.
 *
 * 1. 새 항목이 들어갈 자리(`itemInsertIndex` — 끝에 붙은 숙박 앞, #1175) **바로 앞부터
 *    거꾸로** 좌표 있는 항목. 이동(`MOVE`)·좌표 없는 항목은 건너뛰고, 올레(`WALK`)는 코스
 *    시작점을 쓴다 (`planItemMapCoord`, #743)
 * 2. 앞에 없으면 **자리 뒤** — 그날 끝의 숙소 — 에서 좌표 있는 첫 항목. 숙소 근처에서
 *    낮 일정을 채우는 날이다
 * 3. 그날에 좌표가 하나도 없으면 **전날까지의 마지막 숙소** (`lodgingBasisFor`). 그날 아침의
 *    출발점이다 — 전날의 숙박이 아닌 장소는 보지 않는다 (같은 함수의 판단을 그대로 쓴다)
 * 4. 그것도 없으면 `null` — 지금까지와 같이 제주 기본 화면 · 목록 캐시 재사용으로 연다
 *
 * 기간 밖 일자도 `null` 이다 — 화면이 먼저 막지만(`PlanAddPlaceView`), 전날 숙소로 거슬러
 * 올라가 엉뚱한 기준점을 내지 않게 여기서도 끊는다.
 */
export function addPlaceFocus(day: number, days: PlanDayGroup[]): LatLng | null {
  const group = days[day - 1]
  if (group === undefined) return null

  const items = group.items
  const at = itemInsertIndex(items)

  for (let index = at - 1; index >= 0; index -= 1) {
    const item = items[index]
    const coord = item === undefined ? null : planItemMapCoord(item)
    if (coord !== null) return coord
  }

  for (const item of items.slice(at)) {
    const coord = planItemMapCoord(item)
    if (coord !== null) return coord
  }

  const lodging = lodgingBasisFor(day, days)
  return lodging === null ? null : planItemMapCoord(lodging)
}

/**
 * 담기 **목록 보기**의 거리순 기준점 (#1217). 지도와 같은 점(`addPlaceFocus`)이다.
 *
 * - `undefined` — 상세를 아직 못 받았다. 조회를 미룬다 — 좌표 없이 먼저 받으면 상세가 온 뒤
 *   기준점이 생겨 key 가 바뀌고, 목록이 `placeId` 순에서 거리순으로 한 번 뒤집힌다
 * - `null` — 기준점이 없다(그날 · 전날 숙소 모두 좌표 없음). 좌표 없이 `placeId` 순이다
 *
 * **서버 프리페치와 클라이언트가 이 함수 하나를 본다** — 같은 상세에서 같은 점이 나와야 key 가 맞아
 * 하이드레이션이 성립한다.
 */
export function addPlaceListOrigin(
  detail: Pick<PlanDetail, 'items' | 'totalDays'> | undefined,
  day: number,
): LatLng | null | undefined {
  if (detail === undefined) return undefined
  return addPlaceFocus(day, groupItemsByDay(detail.items, detail.totalDays).days)
}
