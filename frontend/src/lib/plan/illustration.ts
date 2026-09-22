/**
 * 일정 항목 타일의 일러스트 — 사진이 없는 항목의 자리를 채운다 (#842).
 *
 * **키가 `contentType` 이 아니라 `itemType` 이다.** `PlanItemPlace` 에는 `contentType` 이
 * 없어서(`addr1` · `indoor` · `firstImage` · `lat` · `lng` 뿐, `types/plan.ts`) `/places`
 * 목록과 홈이 쓰는 `placeIllustration(contentTypeCode)` 를 이 행에서 부를 수 없다. 대신
 * `item.itemType.code` 가 다섯 값 중 하나로 늘 온다 (`PLAN_ITEM_TYPES`).
 *
 * **`lib/place/illustration.ts` 를 고치지 않는다.** 두 표가 같은 파일 몇 개를 가리키지만
 * **키가 다른 두 매핑**이지 중복이 아니다 — 장소 도메인은 계속 `contentType` 으로 고른다.
 * 실제로 겹치지 않는 쌍이 있다: `MEAL`(일정의 끼니)은 `RESTAURANT`(장소 카테고리)와
 * 이름이 다르고, `WALK` · `MOVE` 에는 대응하는 장소 카테고리가 아예 없다.
 *
 * **유형을 지어내지 않는다.** 자산이 없는 코드에는 아무것도 주지 않고 `null` 을 돌려
 * 호출부가 회색 타일로 떨어뜨리게 한다 (`place/illustration.ts` 와 같은 판단).
 *
 * `itemType` 은 metadata 객체(`{code,name}`)로 오므로 호출부가 `code` 를 넘긴다.
 * **`name`(한국어)으로 고르지 않는다** — 서버 문구가 바뀌면 조용히 깨지고, 한국어를 키로
 * 쓰는 매핑 테이블은 이 저장소가 금지한다 (api-integration-guide §6).
 */
const BY_ITEM_TYPE: Record<string, string> = {
  PLACE: '/illustrations/place-tourist_spot.svg',
  MEAL: '/illustrations/place-restaurant.svg',
  LODGING: '/illustrations/place-lodging.svg',
  WALK: '/illustrations/plan-item-walk.svg',
  MOVE: '/illustrations/plan-item-move.svg',
}

/** 그릴 일러스트의 경로. 없으면 `null` — 호출부가 회색 타일로 떨어뜨린다 */
export function planItemIllustration(itemTypeCode: string | null): string | null {
  if (itemTypeCode === null || itemTypeCode.length === 0) return null

  return BY_ITEM_TYPE[itemTypeCode] ?? null
}
