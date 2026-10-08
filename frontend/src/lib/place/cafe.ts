/**
 * 카페 판정 — `RESTAURANT` + 원천 분류 `카페` (#1156 · #1181 · #1280).
 *
 * **한 곳에만 둔다.** 목록 행의 유형 낱말(`placeTypeLabel`)과 지도 핀 아이콘(`placePinIcon`)이 같은
 * 판정을 써야 같은 곳이 `카페` 와 수저로 갈리지 않는다.
 */
export const CAFE_SOURCE_CATEGORY = '카페'

export function isCafePlace(place: {
  contentType: { code: string }
  sourceCategory: string | null
}): boolean {
  return place.contentType.code === 'RESTAURANT' && place.sourceCategory === CAFE_SOURCE_CATEGORY
}
