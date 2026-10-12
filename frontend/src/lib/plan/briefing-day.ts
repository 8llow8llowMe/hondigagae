import { type RouteItemInput, type RouteModel, toRouteModel } from '@/lib/map/route'
import type { BriefingTarget } from '@/lib/plan/briefing'
import { isPlaceTarget, planItemMapCoord } from '@/lib/plan/detail'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 브리핑 그날 일정의 순수 판단 (#1415 · 여행브리핑-세부명세 D15).
 *
 * 화면(`briefing-day-timeline.tsx`)은 받은 값만 그리고, **무엇이 기준 행인지 · 어디로 길을 안내할지 · 몇 번인지** 는
 * 여기서 정한다 — 렌더 분기가 아니라 판정이라 함수 단위로 잠근다.
 */

/**
 * 날씨 기준 장소의 행 (D15-3). 브리핑 응답의 `representativePlaceId` 는 **장소** id 라 상세 장소 항목의 `targetId` 와
 * 맞춘다. 백엔드가 날씨 기준 장소를 고르는 집합(`PlanItemType.PLACE_TARGETS` — 장소 · 식사 · 숙박)과 같은
 * `isPlaceTarget` 으로 거른다 — 산책 코스의 `targetId` 는 다른 종류의 id 라 보지 않는다. 같은 장소가 두 번이면 첫 항목 하나.
 */
export function basisItemId(
  items: readonly PlanItemDetail[],
  representativePlaceId: string | null,
): string | null {
  if (representativePlaceId === null) return null

  const hit = items.find((item) => isPlaceTarget(item) && item.targetId === representativePlaceId)
  return hit?.planItemId ?? null
}

/**
 * 길찾기가 안내할 다음 갈 곳 (D15-6). 내일 브리핑은 첫 장소, 오늘 브리핑은 아직 안 간 첫 장소 — 좌표 없는 항목은 길을
 * 낼 수 없어 건너뛴다. 없으면 `null`(버튼을 그리지 않는다).
 */
export function nextDestination(
  items: readonly PlanItemDetail[],
  kind: BriefingTarget['kind'],
): PlanItemDetail | null {
  return (
    items.find((item) => planItemMapCoord(item) !== null && (kind === 'EVE' || !item.visited)) ??
    null
  )
}

function toRouteInput(item: PlanItemDetail): RouteItemInput {
  return {
    id: item.planItemId,
    itemTypeCode: item.itemType.code,
    title: item.title,
    coord: planItemMapCoord(item),
  }
}

/**
 * 하루 동선 모델 — 일정 상세의 동선 카드와 브리핑이 **같은 함수**로 번호 · 선을 만든다. 목록 번호가 지도 핀 번호와
 * 같아야 하므로(D15-4) 두 화면이 각자 만들지 않는다.
 */
export function toPlanRouteModel(
  items: readonly PlanItemDetail[],
  lodgingBasis: PlanItemDetail | null,
): RouteModel {
  return toRouteModel({
    items: items.map(toRouteInput),
    lodgingBasis: lodgingBasis === null ? null : toRouteInput(lodgingBasis),
  })
}
