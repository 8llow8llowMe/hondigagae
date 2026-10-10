import type { PlaceFilters } from '@/types/place'

/**
 * 지도 필터 줄 `필터 n` 의 n — **필터 시트 안에 접힌 축만 센다** (#1314 D1-2).
 *
 * 레일에 보이는 축(동반 · 유형)은 칩 자신이 켠 색으로 말하므로 함께 세면 같은 조건을 두 번 말한다.
 * 숫자가 말할 것은 **접혀서 안 보이는** 조건이다. 검색어는 검색 칸이 보인다.
 *
 * - 지역(`sigunguCode`) · 실내/야외(`indoor`) · 체구(`petSizeType`) — 0–3
 * - 체중(`petWeightKg`)은 체구와 같은 축이라 따로 세지 않는다 — 체크 하나가 둘을 함께 켠다
 * - URL 에 체구가 있는데 반려견이 없어 시트에 체구 절이 없어도 센다 — 결과를 줄이는 조건이다 (D5)
 */
export function mapSheetFilterCount(filters: PlaceFilters): number {
  return [filters.sigunguCode, filters.indoor, filters.petSizeType].filter(
    (value) => value !== null,
  ).length
}
