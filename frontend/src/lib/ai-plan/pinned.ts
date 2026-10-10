import type { PinnedPlace } from '@/types/ai-plan'

/**
 * 꼭 넣을 장소 — 상한과 선택 조작 (#128, 아트보드 `혼디가개 AI 일정 생성` 05).
 *
 * 순수 함수로 뽑은 이유: 시트와 폼이 같은 목록을 다루는데, 상한 판정과 토글이 두 곳에
 * 복제되면 "시트에서는 11번째가 담기는데 폼에서는 안 보이는" 종류의 어긋남이 생긴다.
 */

/**
 * 백엔드 `AiPlanCreateRequest.pinnedPlaceIds` 의 `@Size(max = 10)` 복제본이다.
 *
 * 아트보드 05 가 이 값을 `3 / 10` 카운터로 상시 노출하라고 적었다 — 상한·부재는 언제나
 * **비활성 + 이유 + 해결 방법**이다.
 */
export const MAX_PINNED_PLACES = 10

/**
 * 선택 토글. 이미 있으면 빼고, 없으면 더한다.
 *
 * **상한에 닿으면 더하지 않고 그대로 돌려준다.** 호출부가 버튼을 이미 비활성했더라도
 * 여기서 한 번 더 막는다 — 키보드·연타로 비활성 반영보다 먼저 들어올 수 있다.
 *
 * **빼는 것은 상한과 무관하다.** 10곳을 채운 상태에서도 해제는 되어야 한다.
 */
export function togglePinnedPlace(places: PinnedPlace[], place: PinnedPlace): PinnedPlace[] {
  const index = places.findIndex((item) => item.placeId === place.placeId)
  if (index !== -1) {
    return places.filter((item) => item.placeId !== place.placeId)
  }

  if (places.length >= MAX_PINNED_PLACES) return places

  return [...places, place]
}

/** 이름이 없는 장소는 후보로 넘길 수 없다 — 서버가 이름·좌표로 배치를 정한다 (아트보드 05) */
export function isPinnable(title: string | null): title is string {
  return title !== null && title.trim() !== ''
}
