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

/**
 * 장소명으로 본 카페 · 제과 · 디저트 낱말 (#1472). `tea` 는 `steak` 에 걸려 쓰지 않는다.
 *
 * dev 음식점 814곳 실측(2026-10-13): 이 낱말에 걸린 곳은 모두 카페 · 제과점 · 애견카페였다. 식당이
 * 걸린 곳은 없다. 이름에 단서가 없는 카페(`델문도` 등)는 놓친다.
 */
const CAFE_TITLE_PATTERN =
  /카페|까페|커피|cafe|café|coffee|베이커리|베이커스|bakery|제과|빵집|디저트|케이크|케이커리|찻집|다방|로스터|라떼|티하우스/i

/**
 * **끼니로 세지 않을** 음식점인가 — 담기 항목 유형(`placeItemTypeOf`)만 쓴다 (#1472).
 *
 * 원천 분류가 `카페` 이거나, 장소명이 카페 · 제과 낱말을 담으면 참이다. 관광정보 API 음식점은
 * 카페든 식당이든 원천 분류가 비어 있고(dev 814곳 중 688곳), 식약처 카페는 `휴게음식점` 으로 와서
 * 원천 분류만으로는 카페 대부분을 식사로 담았다.
 *
 * **목록 배지 · 지도 핀 · `카페` 칩은 `isCafePlace` 그대로다.** 그쪽은 서버 조건
 * (`sourceCategory=카페`)으로 찾는 칩과 같은 판정이어야 한다(#1181). 이름 판정을 섞으면 칩에는
 * 없는 곳이 커피잔으로 보이고, 배지에 `휴게음식점` 같은 원천 문자열이 그대로 나온다.
 * 서버가 카페 여부를 실으면(#1473) 이 어림을 걷는다.
 */
export function isCafeLikePlace(place: {
  contentType: { code: string }
  sourceCategory: string | null
  title: string
}): boolean {
  if (place.contentType.code !== 'RESTAURANT') return false
  return isCafePlace(place) || CAFE_TITLE_PATTERN.test(place.title)
}
