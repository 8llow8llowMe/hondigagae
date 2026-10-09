import { MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'

/**
 * 장소 찾기 지도의 병원 · 약국 층 — 무엇을 조회하나 (#1286, `docs/features/place/지도시설토글-세부명세.md` D3-1).
 *
 * **고정 중심 · 50km.** 지도 중심을 따르지 않는다 — 한 번 받으면 섬 전체가 끝나서(dev 실측 213곳 ·
 * 최원거리 40,499m) 지도를 옮길 때마다 다시 부를 일이 없고, `/places` 가 지킨 "지도를 옮겼다고 스스로
 * 재조회하지 않는다"(#396)와 맞는다. 중심을 따르면 key 가 매번 갈려 캐시가 쌓이고 경계 밖 시설이 나타났다
 * 사라진다.
 *
 * 중심은 **조회 기준점** 상수(`JEJU_QUERY_CENTER` · 제주시청)다 — 지도 기준(`JEJU_MAP_ANCHOR`)이 아니다.
 */
export const FACILITY_LAYER_CENTER = JEJU_QUERY_CENTER

/** 백엔드 `@Max(50000)` — 상한 그대로 */
export const FACILITY_LAYER_RADIUS = MAX_RADIUS_METERS

/**
 * 조회 기준점. **끄면 `null` 이다 — 그리고 `null` 이면 조회가 나가지 않는다**
 * (`useNearbyFacilities` 의 `enabled: position !== null`). 토글을 켜기 전에는 요청이 절대 없다는 규칙
 * (`architecture-guide.md` §9 "지도 뷰 첫 화면은 별도 조회 금지")을 이 한 줄이 쥔다.
 */
export function facilityLayerPosition(on: boolean): { lat: number; lng: number } | null {
  return on ? FACILITY_LAYER_CENTER : null
}
