'use client'

import { useNearbyFacilities } from '@/features/emergency/use-nearby-facilities'
import { FACILITY_LAYER_RADIUS, facilityLayerPosition } from '@/lib/emergency/facility-layer'

/**
 * 장소 찾기 지도의 병원 · 약국 층 조회 (#1286 D3-1).
 *
 * **끄면 조회가 나가지 않는다** — 기준점이 `null` 이 되고 `useNearbyFacilities` 가 `enabled: false` 다.
 * 켜면 제주시청 · 50km · 250 한 번이고, key · `staleTime`(1분 — `openNow` 가 시각에 따라 바뀐다) · 재시도는
 * 그 훅 그대로다. 다시 켜면 1분 안에는 캐시라 요청이 없다.
 *
 * **끈 동안의 `data` 를 쓰지 않는다.** 그 훅은 `placeholderData: previous` 라 기준점이 `null` 로 바뀌어도 직전
 * 응답이 남아 보인다 — 호출부는 반드시 토글 값과 함께 읽는다(`facilityLayerStatus`).
 *
 * `features/emergency` 를 가져온다 — `home-view` 가 같은 훅을 가져오는 선례를 따른다(명세 D8-4 A).
 */
export function useFacilityLayer(on: boolean) {
  return useNearbyFacilities(facilityLayerPosition(on), FACILITY_LAYER_RADIUS)
}
