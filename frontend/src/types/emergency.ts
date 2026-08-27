import type { EnumMetadata } from '@/types/api'

/**
 * 긴급 시설(동물병원·동물약국) — `GET /api/v1/emergencies/facilities`
 * 근거: backend `NearbyFacilityResponse` / `NearbyFacilityItem` / `EmergencyFacilityType`
 */
export const EMERGENCY_FACILITY_CODES = ['ANIMAL_HOSPITAL', 'ANIMAL_PHARMACY'] as const
export type EmergencyFacilityCode = (typeof EMERGENCY_FACILITY_CODES)[number]

export type EmergencyFacility = {
  /**
   * **주의: 백엔드가 `long` 으로 내려준다.** 예시값 4611686018427387904 는
   * Number.MAX_SAFE_INTEGER(9007199254740991)를 초과해 JS에서 정밀도가 손상된다.
   * `placeId` 처럼 String 직렬화를 요청해 둔 상태다 (BE 후속 요청).
   * 그때까지 이 값을 키·경로에 쓰지 않는다.
   */
  facilityId: number
  facilityType: EnumMetadata
  name: string
  addr: string
  lat: number
  lng: number
  tel: string | null
  /** 원천에 정보가 없으면 null. **"휴무"가 아니라 "확인 필요"를 뜻한다** */
  operatingHours: string | null
  restDate: string | null
  open24: boolean
  /** false 면 화면에서 "영업시간 정보 없음"으로 안내한다 (백엔드 스키마 지침) */
  operatingHoursKnown: boolean
  distanceMeters: number
}

export type NearbyFacilityResult = {
  facilities: EmergencyFacility[]
  totalCount: number
  radius: number
  /** 제주 동물병원 중 24시간은 3곳뿐이라 true 로 조회하면 결과가 매우 적다 */
  open24Only: boolean
  providerName: string
}
