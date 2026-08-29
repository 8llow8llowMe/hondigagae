import type { CodeNameMetadata } from '@/types/api'

/**
 * 긴급 시설 (동물병원 · 동물약국).
 *
 * 근거: backend tour-service `emergency` 컨텍스트 **소스 실측** —
 * `NearbyFacilityWebController` / `NearbyFacilityResponse` / `NearbyFacilityItem` /
 * `EmergencyFacilityType` (2026-08-29). 게이트웨이 기동 후 `/fe-api-check` 로 재대조한다.
 *
 * **`facilityId` 는 문자열이다.** 이슈 #8 이 "JS 안전 정수 범위를 초과한다" 고 지적했고
 * 백엔드가 이미 `String` 으로 고쳤다 — Schema 주석이 그 이유를 적어 두고 있다.
 * **number 로 타이핑하면 정밀도가 손상된다.**
 */
export const FACILITY_TYPE_CODES = ['ANIMAL_HOSPITAL', 'ANIMAL_PHARMACY'] as const
export type FacilityTypeCode = (typeof FACILITY_TYPE_CODES)[number]

export type NearbyFacilityItem = {
  facilityId: string
  facilityType: CodeNameMetadata
  name: string
  addr: string
  lat: number
  lng: number
  /** **null 이면 등록된 번호가 없다.** 전화 버튼을 숨기지 않고 비활성 + 이유를 준다 */
  tel: string | null
  /**
   * 운영시간 **원문 문자열**. `"월~금 09:00~19:00, 토 09:00~13:00"` 처럼 온다.
   *
   * **파싱해서 "오늘 19:00까지" 로 요약하지 않는다** (아트보드 주석). 서식이 조금만 달라도
   * 틀린 시간을 말하게 된다. 그대로 렌더한다.
   */
  operatingHours: string | null
  restDate: string | null
  open24: boolean
  /**
   * 지금 영업 중인지. **`null` 은 "닫힘" 이 아니라 "판정할 수 없음"** 이다 —
   * 영업시간 정보가 없는 곳이다. 배지 3상태의 근거다.
   */
  openNow: boolean | null
  /** false 면 화면에서 "진료시간이 등록돼 있지 않아요" 로 안내한다 */
  operatingHoursKnown: boolean
  /** 검색 중심점으로부터의 거리(m) */
  distanceMeters: number
}

/**
 * `GET /emergencies/facilities`
 *
 * **`SliceResponse` 가 아니다.** `totalCount` 가 있어 건수 표기가 가능하다 —
 * 장소 목록과 다른 점이다.
 */
export type NearbyFacilityResult = {
  /** 가까운 순. 병원과 약국이 **섞여** 온다 */
  facilities: NearbyFacilityItem[]
  totalCount: number
  radius: number
  /** 24시간 확인된 곳만 걸렀는지. 제주 동물병원 중 3곳뿐이라 true 면 결과가 매우 적다 */
  open24Only: boolean
  providerName: string
}

/** 조회 조건. `lat`/`lng` 는 필수다 */
export type NearbyFacilityQuery = {
  lat: number
  lng: number
  /** 1~50000. 기본 10000 */
  radius: number
  size: number
}

/**
 * 화면에서 좁히는 축. **서버 파라미터로 보내지 않는다** — 이유는
 * `src/features/emergency/facility-filters.ts` 주석에 있다.
 */
export type FacilityFilters = {
  /** null 이면 전체(병원 + 약국) */
  type: FacilityTypeCode | null
  open24Only: boolean
  openNowOnly: boolean
}

export const DEFAULT_FACILITY_FILTERS: FacilityFilters = {
  type: null,
  open24Only: false,
  openNowOnly: false,
}
