import type { LatLng } from '@/lib/geo/coord'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'

/**
 * 제주 4권역의 **대표 좌표** — 위치를 쓸 수 없는 사람이 기준점을 직접 고르는 손잡이다
 * (#639, 세부명세 D3-2).
 *
 * 긴급 시설 화면에서 위치 권한이 없으면 조회가 제주 중심으로 폴백하고 거리가 사라진다.
 * 그때 사용자가 할 수 있는 일이 "다시 시도" 하나뿐이었는데, 브라우저가 권한을 영구
 * 거부한 상태면 눌러도 프롬프트가 뜨지 않는다 — 막다른 길이다. 권역을 고르면 기준점이
 * 그 자리로 옮겨 가 **거리가 되살아난다**.
 *
 * **서버 enum 이 아니라 FE 지리 상수다.** 홈 권역 날씨의 서버 `regions[].name`(`제주시권`
 * 등)과 이름을 맞추고 싶지만 그 응답은 이 화면에 오지 않는다. 라벨은
 * `messages.emergency.regionLabel` 이 갖는다 — 값이 서버에 있으면 그것을 쓰고,
 * 없는 자리의 고정 라벨만 FE 가 적는다 (`messages.emergency.typeByCode` 와 같은 판정).
 *
 * **한라산권이 없다** (D8-3). 홈 권역 날씨는 5권역이지만 한라산에는 병원이 없다 —
 * 고를 수 있는데 언제나 0건인 칩은 손잡이가 아니라 함정이다.
 */
export const JEJU_REGION_CODES = ['JEJU_CITY', 'SEOGWIPO', 'EAST', 'WEST'] as const

export type JejuRegionCode = (typeof JEJU_REGION_CODES)[number]

/**
 * **제주시는 `JEJU_QUERY_CENTER` 를 그대로 재사용한다.** 값이 같다고 새로 적으면 한쪽만
 * 고쳐졌을 때 "제주 중심 폴백" 과 "제주시 권역" 이 조용히 다른 곳을 조회한다 —
 * `JEJU_CENTER`(coord.ts)와 `JEJU_QUERY_CENTER` 가 섞였던 #14 가 바로 그 사고였다.
 *
 * 나머지 셋은 사람이 사는 쪽의 지명 좌표다: 서귀포시청 · 성산일출봉 인근 · 한림공원 인근.
 * 권역의 기하 중심이 아니다 — 기하 중심은 바다나 중산간으로 떨어져 반경 안이 빈다.
 */
export const JEJU_REGION_CENTERS: Record<JejuRegionCode, LatLng> = {
  JEJU_CITY: JEJU_QUERY_CENTER,
  SEOGWIPO: { lat: 33.2541, lng: 126.5601 },
  EAST: { lat: 33.4585, lng: 126.9426 },
  WEST: { lat: 33.3893, lng: 126.241 },
}
