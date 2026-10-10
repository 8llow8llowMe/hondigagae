import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import { itemInsertIndex } from '@/lib/plan/day-items'
import {
  groupItemsByDay,
  lodgingBasisFor,
  type PlanDayGroup,
  planItemMapCoord,
} from '@/lib/plan/detail'
import type { PlanDetail, PlanItemDetail } from '@/types/plan'

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
  return addPlaceFocusBasis(day, days)?.coord ?? null
}

/**
 * 기준점이 **어디서 왔는가** (#1221) — 위 순서의 1 · 2 · 3 단계.
 *
 * - `previous` — 들어갈 자리 앞 항목 (1)
 * - `lodging` — 자리 뒤, 그날 끝의 숙소 (2). `itemInsertIndex` 가 끝에 붙은 숙박 묶음 앞이라 자리 뒤는
 *   숙박뿐이다
 * - `previous-lodging` — 전날까지의 마지막 숙소 (3)
 */
export type AddPlaceFocusKind = 'previous' | 'lodging' | 'previous-lodging'

/** 기준점과 그 출처 · 항목 (#1221). 목록 위 한 줄이 "어느 장소에서 잰 거리인가" 를 말하는 재료다 */
export type AddPlaceFocusBasis = {
  coord: LatLng
  kind: AddPlaceFocusKind
  item: PlanItemDetail
}

/**
 * `addPlaceFocus` 의 판정을 출처 · 항목과 함께 돌려준다 (#1221). **판정은 여기 하나다** —
 * `addPlaceFocus` 는 이것의 좌표만 꺼낸다. 둘이 따로 셈하면 목록 위 한 줄이 말하는 장소와 실제로 잰
 * 점이 갈린다.
 */
export function addPlaceFocusBasis(day: number, days: PlanDayGroup[]): AddPlaceFocusBasis | null {
  const group = days[day - 1]
  if (group === undefined) return null

  const items = group.items
  const at = itemInsertIndex(items)

  for (let index = at - 1; index >= 0; index -= 1) {
    const item = items[index]
    const coord = item === undefined ? null : planItemMapCoord(item)
    if (item !== undefined && coord !== null) return { coord, kind: 'previous', item }
  }

  for (const item of items.slice(at)) {
    const coord = planItemMapCoord(item)
    if (coord !== null) return { coord, kind: 'lodging', item }
  }

  const lodging = lodgingBasisFor(day, days)
  const coord = lodging === null ? null : planItemMapCoord(lodging)
  return lodging === null || coord === null
    ? null
    : { coord, kind: 'previous-lodging', item: lodging }
}

/**
 * 담기 **목록 보기**의 거리순 기준점 (#1217 · #1221). 지도와 같은 점(`addPlaceFocusBasis`)이다.
 *
 * - `undefined` — 상세를 아직 못 받았다. 조회를 미룬다 — 좌표 없이 먼저 받으면 상세가 온 뒤
 *   기준점이 생겨 key 가 바뀌고, 목록이 `placeId` 순에서 거리순으로 한 번 뒤집힌다
 * - `null` — 기준점이 없다(그날 · 전날 숙소 모두 좌표 없음). 좌표 없이 `placeId` 순이다
 *
 * 화면은 이것을 얼려 **좌표는 조회에, 출처 · 이름은 목록 위 한 줄에** 쓴다 — 둘이 같은 값에서 나와야
 * 말하는 장소와 잰 점이 같다.
 */
export function addPlaceListBasis(
  detail: Pick<PlanDetail, 'items' | 'totalDays'> | undefined,
  day: number,
): AddPlaceFocusBasis | null | undefined {
  if (detail === undefined) return undefined
  return addPlaceFocusBasis(day, groupItemsByDay(detail.items, detail.totalDays).days)
}

/**
 * `addPlaceListBasis` 의 좌표만 — **서버 프리페치가 key 를 만들 때 쓴다** (#1217). 클라이언트가 얼린
 * 기준점의 좌표와 같은 상세에서 같은 점이 나와야 key 가 맞아 하이드레이션이 성립한다.
 */
export function addPlaceListOrigin(
  detail: Pick<PlanDetail, 'items' | 'totalDays'> | undefined,
  day: number,
): LatLng | null | undefined {
  const basis = addPlaceListBasis(detail, day)
  return basis === undefined ? undefined : (basis?.coord ?? null)
}

/**
 * 이름 상한(글자). **줄 끝이 아니라 이름 안에서 줄인다** — 줄을 말줄임하면 "가까운 순이에요" 가 잘려
 * 문장이 무엇을 말하는지 사라진다. 16 은 390 폭 캡션 한 줄에 출처 낱말(`전날 숙소`)과 문장 꼬리가
 * 함께 들어가는 길이다 — 넘치면 두 줄로 접힐 뿐 정보는 남는다.
 */
const NAME_MAX = 16

/**
 * 목록 위 한 줄 (#1221 — 사용자 결정 "출처 + 이름"). 기준점이 없으면 `null` — 줄 자체가 없다.
 *
 * **출처 낱말은 숙소일 때만 붙인다.** 직전 장소는 "방금 들른 곳" 이라 이름이 곧 출처다. 숙소는
 * 이름만으로 숙소인지 알 수 없어(`○○ 리조트` 가 낮 일정일 수도 있다) 붙이고, 전날 숙소는 그날 일정에
 * 없는 장소라 "전날" 까지 붙인다. **올레는 시작점이라고 말한다** — 코스 전체가 아니라 시작점에서 잰다
 * (`planItemMapCoord`).
 */
export function addPlaceNearbyCaption(basis: AddPlaceFocusBasis | null): string | null {
  if (basis === null) return null

  const name =
    basis.item.title.length > NAME_MAX
      ? `${basis.item.title.slice(0, NAME_MAX)}…`
      : basis.item.title

  if (basis.item.itemType.code === 'WALK') {
    return messages.plan.addPlaceNearbyCaptionWalk.replace('{name}', name)
  }
  const template = {
    previous: messages.plan.addPlaceNearbyCaptionPrevious,
    lodging: messages.plan.addPlaceNearbyCaptionLodging,
    'previous-lodging': messages.plan.addPlaceNearbyCaptionPreviousLodging,
  }[basis.kind]
  return template.replace('{name}', name)
}

/**
 * 지도 기준점 마커에 실을 이름 (#1223). 기준점이 없으면 `null` — 마커도 없다.
 *
 * **목록 문구(`addPlaceNearbyCaption`)와 같은 판정에서 나온다** — 찍는 자리와 이름이 갈리지 않게.
 * 출처 낱말(숙소 · 전날 숙소)은 싣지 않는다: 마커는 그 자리에 서 있어 "어디" 를 이미 말하고, 이름표가
 * 길어질수록 지도를 덮는다. 줄임은 CSS(`.map-pin > span` 말줄임)가 맡는다. **올레는 시작점이라고
 * 붙인다** — 코스 전체가 아니라 시작점을 찍는다.
 */
export function addPlaceFocusMarkerName(basis: AddPlaceFocusBasis | null): string | null {
  if (basis === null) return null
  return basis.item.itemType.code === 'WALK'
    ? messages.plan.addPlaceFocusWalkStart.replace('{name}', basis.item.title)
    : basis.item.title
}
