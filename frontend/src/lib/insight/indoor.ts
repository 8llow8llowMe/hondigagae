import type { AlternativePlaceItem, PlaceSuitabilityResponse } from '@/types/insight'

/**
 * 비 예보일 때 홈이 제안할 실내 대안 (홈-세부명세 D1 · D5-1 §13).
 *
 * **추가 호출이 없다.** `indoorAlternatives` 는 홈이 이미 부르는
 * `GET /places/{id}/suitability` 응답에 들어 있다 — 비가 예보된 날에만 채워지고
 * 아니면 빈 배열이라, 이 함수가 빈 배열을 돌려주는 날은 섹션 자체가 안 뜬다.
 *
 * 적합도를 N곳 조회하므로 **같은 대안이 여러 응답에 겹쳐 온다** — 서로 가까운 장소들이
 * 같은 실내를 가리키기 때문이다. `placeId` 로 접지 않으면 홈에 같은 미술관이 세 번 뜬다.
 *
 * **이미 목록에 있는 장소는 대안이 아니다.** 위에서 "오늘 맞는 곳" 으로 보여 준 곳을
 * 아래에서 "비 오면 여기" 로 또 세우면, 같은 화면이 같은 장소를 두 번 권한다.
 *
 * 거리는 **기준 장소로부터의 직선거리**다 (`AlternativePlaceItem`). 응답마다 기준이
 * 다르므로 겹치는 대안은 **가장 가까운 값**을 남긴다 — 더 먼 기준의 값을 남기면 화면이
 * 실제보다 멀다고 말한다.
 */
export function collectIndoorAlternatives(
  suitabilities: PlaceSuitabilityResponse[],
  excludePlaceIds: Iterable<string>,
  limit: number,
): AlternativePlaceItem[] {
  const excluded = new Set(excludePlaceIds)
  const byPlaceId = new Map<string, AlternativePlaceItem>()

  for (const suitability of suitabilities) {
    for (const alternative of suitability.indoorAlternatives) {
      if (excluded.has(alternative.placeId)) continue

      const kept = byPlaceId.get(alternative.placeId)
      if (kept === undefined || alternative.distanceMeters < kept.distanceMeters) {
        byPlaceId.set(alternative.placeId, alternative)
      }
    }
  }

  return [...byPlaceId.values()].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit)
}
