import type { FavoritePlaceItem } from '@/types/favorite'

/**
 * 저장한 장소 항목 픽스처.
 *
 * 값은 아트보드 `혼디가개 저장한 장소` 01 의 첫 행(협재해수욕장)을 그대로 쓴다 —
 * 화면 문구를 검증할 때 아트보드와 같은 문자열을 보는 편이 어긋남을 빨리 드러낸다.
 */
export function favoritePlaceItem(overrides: Partial<FavoritePlaceItem> = {}): FavoritePlaceItem {
  return {
    placeId: '212481712381923328',
    title: '협재해수욕장',
    contentTypeName: '관광지',
    addr: '제주특별자치도 제주시 한림읍',
    petAllowanceName: '동반 가능',
    indoor: false,
    firstImage: null,
    ...overrides,
  }
}

/**
 * 요약 조회가 실패한 항목 — **`placeId` 만 온다.**
 *
 * tour-service 조회가 실패해도 placeId 목록은 내려간다 (`FavoritePlaceInfo` 주석).
 * 이 모양이 화면에서 사라지지 않는 것이 명세 D5 의 핵심 케이스다.
 */
export function favoritePlaceItemWithoutSummary(
  overrides: Partial<FavoritePlaceItem> = {},
): FavoritePlaceItem {
  return {
    placeId: '212481712381923999',
    title: null,
    contentTypeName: null,
    addr: null,
    petAllowanceName: null,
    indoor: null,
    firstImage: null,
    ...overrides,
  }
}
