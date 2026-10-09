import type { MapPinShape } from '@/lib/map/pin-content'
import type { MapPinIcon } from '@/lib/map/pin-icons'
import type { NearbyFacilityItem } from '@/types/emergency'

/**
 * 긴급 시설 → 지도 핀 (#1286, `docs/features/place/지도시설토글-세부명세.md` D2-2 · D3-3).
 *
 * **어느 시설을 어느 그림으로 그릴지는 긴급 도메인이 정한다** — 지도 층(`lib/map`)은 `cross` · `pill` ·
 * `square` 라는 낱말만 알고 동물병원을 모른다. 장소 쪽 `lib/place/pin-icon.ts` 와 같은 분담이다.
 *
 * **`MapPin` 을 가져오지 않는다.** `MapPin` 은 `features/map/map-canvas.tsx` 에 있어 `lib/` 이 가져오면 층이
 * 뒤집힌다 — 같은 모양의 객체를 구조적으로 만든다(`pin-content.ts` 의 `PinContentInput` 과 같은 수법).
 */

/**
 * `facilityType.code` → 아이콘. **한국어 `name` 으로 고르지 않는다** — 표시 문자열은 서버 metadata 라 바뀔
 * 수 있다. 모르는 코드는 범용 핀이다 — 분류를 지어내지 않는다.
 */
const BY_CODE: Record<string, MapPinIcon> = {
  ANIMAL_HOSPITAL: 'cross',
  ANIMAL_PHARMACY: 'pill',
}

export function facilityPinIcon(code: string): MapPinIcon {
  // 자기 키만 본다 — 평범한 객체라 `constructor` 같은 프로토타입 키가 `??` 를 지나친다
  return (Object.hasOwn(BY_CODE, code) ? BY_CODE[code] : undefined) ?? 'pin'
}

/**
 * 장소 지도에서 시설 핀의 id 앞머리 (D3-3). 장소 id 는 숫자 문자열이라 이 앞머리와 겹치지 않는다 —
 * `MapCanvas` 의 `selectedId` 하나로 장소와 시설을 함께 다루면서 **동시에 하나만** 이 구조로 지켜진다.
 */
const FACILITY_PIN_PREFIX = 'facility:'

/** `facilityId`(Snowflake 문자열)를 그대로 붙인다 — 숫자로 바꾸지 않는다 */
export function facilityPinId(facilityId: string): string {
  return `${FACILITY_PIN_PREFIX}${facilityId}`
}

/** 시설 핀 id 면 `facilityId`, 아니면(장소 핀) `null` */
export function readFacilityPinId(pinId: string): string | null {
  if (!pinId.startsWith(FACILITY_PIN_PREFIX)) return null
  const facilityId = pinId.slice(FACILITY_PIN_PREFIX.length)
  return facilityId === '' ? null : facilityId
}

/** `MapPin` 과 같은 모양 — 구조적으로 대입된다 */
export type FacilityPin = {
  id: string
  title: string
  lat: number | null
  lng: number | null
  caption: string | null
  muted: boolean
  icon: MapPinIcon
  shape: MapPinShape
}

/**
 * 시설 하나를 핀으로. `id` · `caption` 은 화면이 정한다 — `/emergency` 는 `facilityId` 그대로와 거리,
 * `/places` 는 `facilityPinId` 와 `null`(조회 중심이 제주시청이라 거리가 사용자와 무관하다, D3-1).
 *
 * - **늘 사각이다** — 장소 원과 모양으로 가른다. 등급 색을 마커에 쓰지 않는다(DESIGN.md §0-4)
 * - **약국은 낮춤 채움이다**(`muted`) — 병원 ↔ 약국은 아이콘(십자 ↔ 알약)이 가르고 명도는 덧붙이는 신호다
 */
export function toFacilityPin(
  item: NearbyFacilityItem,
  { id, caption }: { id: string; caption: string | null },
): FacilityPin {
  return {
    id,
    title: item.name,
    lat: item.lat,
    lng: item.lng,
    caption,
    muted: item.facilityType.code === 'ANIMAL_PHARMACY',
    icon: facilityPinIcon(item.facilityType.code),
    shape: 'square',
  }
}
