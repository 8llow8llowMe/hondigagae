import type { LatLng } from '@/lib/geo/coord'
import type { PositionResult } from '@/lib/geo/current-position'
import { JEJU_REGION_CENTERS, type JejuRegionCode } from '@/lib/geo/jeju-regions'

/**
 * 거리·정렬이 **무엇을 기준으로 한 값인지.** 화면이 넷을 서로 다른 문구로 말한다.
 *
 * - `map` — 재검색으로 옮긴 지도 중심. 거리는 진짜 거리지만 내 위치에서가 아니다 (#396)
 * - `region` — 권역 세그먼트로 고른 자리 (#639). `map` 과 같은 성격이다: 사용자가 직접
 *   골랐으므로 그 자리에서의 거리는 알고 싶은 사실이다
 * - `current` — 내 위치. 거리를 그대로 보여준다
 * - `jeju` — 좌표를 못 받아 제주 중심으로 폴백. **거리를 감춘다** (제주 중심에서 480m 인
 *   것을 "480m" 로 쓰면 사용자는 자기 위치에서 480m 로 읽는다)
 */
export type EmergencyBasis = 'map' | 'region' | 'current' | 'jeju'

export type AnchorInput = {
  /** "이 지역에서 재검색" 으로 옮긴 지도 중심. `null` 이면 옮기지 않았다 (#396) */
  searchCenter: LatLng | null
  /** 권역 세그먼트로 고른 기준 지역. `null` 이면 고르지 않았다 (#639) */
  regionCode: JejuRegionCode | null
  /** `getCurrentPosition()` 의 결과. `null` 이면 **아직 묻는 중**이다 */
  position: PositionResult | null
}

/**
 * 네 입력을 **하나의 조회 기준점**으로 접는다 — 세부명세 D3-1.
 *
 * ```text
 * anchor = searchCenter ?? regionCenter ?? position(granted) ?? JEJU_QUERY_CENTER
 * ```
 *
 * **순서에 이유가 있다.** 지도 재검색이 권역보다 센 것은 *둘이 동시에 살아 있을 때
 * 사용자가 마지막에 한 행동이 지도*이기 때문이고(지도에서 목록으로 돌아온 경우),
 * 권역이 현재 위치보다 센 것은 *권역은 방금 직접 고른 자리*이기 때문이다.
 *
 * **`anchor === null` 은 "조회하지 마라" 는 뜻이다.** 좌표를 아직 묻는 중이면 여기서
 * 제주 중심을 미리 넣지 않는다 — 넣으면 좌표가 오기 전에 한 번, 온 뒤에 또 한 번
 * 조회가 나가고 첫 화면이 두 번 바뀐다.
 *
 * **`basis` 를 좌표로 역산하지 않는다.** 제주시 권역은 `JEJU_QUERY_CENTER` 와 같은
 * 좌표지만 `jeju` 가 아니라 `region` 이다 — 사용자가 직접 골랐다는 사실이 거리를
 * 보여줄지 말지를 가른다.
 *
 * 순수 함수라 node 환경에서 그대로 테스트한다 (docs/testing-guide.md §1).
 */
export function resolveAnchor({ searchCenter, regionCode, position }: AnchorInput): {
  anchor: LatLng | null
  basis: EmergencyBasis
} {
  if (searchCenter !== null) return { anchor: searchCenter, basis: 'map' }
  if (regionCode !== null) return { anchor: JEJU_REGION_CENTERS[regionCode], basis: 'region' }

  // 아직 묻는 중 — 기준이 정해지지 않았을 뿐 폴백이 확정된 것은 아니다
  if (position === null) return { anchor: null, basis: 'current' }

  return {
    anchor: { lat: position.lat, lng: position.lng },
    basis: position.kind === 'granted' ? 'current' : 'jeju',
  }
}

/**
 * 거리를 화면에 써도 되는가. **제주 중심 폴백만 감춘다** (D3-1).
 *
 * 함수로 두는 이유는 `basis !== 'jeju'` 를 두 곳에 적지 않기 위해서다 — 갈리면 목록은
 * 거리를 보여주고 요약 줄은 "제주 중심 기준" 이라고 말하는 화면이 된다.
 */
export function showsDistance(basis: EmergencyBasis): boolean {
  return basis !== 'jeju'
}
