import type { NearbyFacilityItem, NearbyFacilityResult } from '@/types/emergency'

/**
 * 장소 찾기 지도의 병원 · 약국 층 — 그릴 시설과 고른 시설의 파생 (#1286 `지도시설토글-세부명세.md` D3-3).
 *
 * `place-map-view.tsx` 는 훅과 상태를 쥐어 node 에서 렌더되지 않는다(`testing-guide.md` §1). 그 안의 판단만
 * 떼어 테스트로 잠근다 — `facilityLayerStatus` 와 같은 분할이다.
 */

/**
 * 지도에 그릴 시설. **끄면 응답이 남아 있어도 `undefined` 다** — 조회 훅은 `placeholderData: previous` 라 끈 뒤에도
 * 직전 응답을 남긴다(`useFacilityLayer`). 끔을 먼저 보지 않으면 꺼진 층의 핀이 이전 응답으로 되살아난다.
 */
export function facilityLayerFacilities({
  on,
  data,
}: {
  on: boolean
  data: NearbyFacilityResult | undefined
}): NearbyFacilityItem[] | undefined {
  return on ? data?.facilities : undefined
}

/**
 * 고른 시설을 **최신 응답에서 id 로 찾는다** — `openNow` 가 1분마다 갱신된다.
 *
 * `gone` — 응답이 있는데 고른 id 가 없다. 호출부는 고른 id 를 **비운다**: 비우지 않으면 같은 id 가 나중 응답에
 * 다시 올 때 사용자가 닫은 적 없는 요약이 저절로 다시 열린다. 응답이 아직 없으면(받는 중 · 꺼짐) 판단하지 않는다.
 */
export function pickedFacility({
  picked,
  facilities,
}: {
  picked: string | null
  facilities: NearbyFacilityItem[] | undefined
}): { facility: NearbyFacilityItem | null; gone: boolean } {
  if (picked === null || facilities === undefined) return { facility: null, gone: false }

  const found = facilities.find((item) => item.facilityId === picked) ?? null
  return { facility: found, gone: found === null }
}

/**
 * URL 의 장소 선택(`?place=`)이 시설 선택을 이기는가.
 *
 * 시설 선택은 화면 안 상태라 기록에 없다(D8-1). 장소 A 를 연 뒤(`push ?place=A`) 시설을 고르면 `history.back` 으로
 * `?place=` 가 걷히는데, 그 뒤 **브라우저 앞으로** 가면 URL 은 `?place=A` 로 돌아오고 시설은 고른 채 남는다 — 둘이
 * 함께 골라진 상태다. 그래서 장소 선택이 **null 이 아닌 다른 값으로 바뀌면** 시설을 비운다.
 *
 * null 로 바뀌는 것은 건드리지 않는다 — 시설을 고를 때 장소 미리보기를 닫는 그 `history.back` 이다.
 */
export function placeTakesOverFacility(previous: string | null, next: string | null): boolean {
  return next !== null && next !== previous
}
