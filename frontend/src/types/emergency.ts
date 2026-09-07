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
 * **`SliceResponse` 가 아니다** — 커서가 없다.
 */
export type NearbyFacilityResult = {
  /** 가까운 순. 병원과 약국이 **섞여** 온다 */
  facilities: NearbyFacilityItem[]
  /**
   * **총계가 아니다 — `facilities.length` 와 같은 값이다.**
   *
   * 이름이 총계처럼 보여 예전에는 잘림 판정에 썼는데, dev 실측에서 `size` 를 3 / 10 / 50
   * 으로 바꿔 부르면 `totalCount` 도 3 / 10 / 50 으로 따라온다(제주시청 · radius 10km).
   * 즉 이 값으로는 "더 있는지" 를 알 수 없다.
   *
   * 잘림은 **상한에 닿았는지**로 판단한다 (`countsAreComplete`).
   * 백엔드 계약을 손대야 할 사안이라 별도 이슈로 올린다.
   */
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

// ─── 일정 응급 브리핑 (#125) ──────────────────────────────────────────────────

/**
 * 일정 브리핑의 시설 한 곳.
 *
 * **`/emergencies/facilities` 의 `NearbyFacilityItem` 과 다른 타입이다.** 훨씬 얇다 —
 * `facilityId` · `lat` · `lng` · `operatingHours` · `openNow` 가 **없다.** 같은 것으로
 * 착각해 `FacilityRow` 를 재사용하면 없는 필드를 읽게 된다.
 *
 * 그 차이가 화면을 하나 못 만들게 한다: **좌표가 없어 길찾기 링크를 만들 수 없다**
 * (`directionsUrl` 이 좌표 없이는 null 이고, 눌러도 못 가는 버튼은 달지 않는다).
 */
export type PlanEmergencyFacility = {
  name: string
  /** **metadata 가 아니라 표시명 문자열이다** — `'동물병원'` · `'동물약국'` */
  typeName: string
  addr: string
  tel: string
  distanceMeters: number
  open24: boolean
  /**
   * **`false` 는 휴무가 아니라 "확인 필요" 다** (백엔드 스키마 명시). 닫혔다고 쓰면
   * 실제로 여는 병원을 사용자가 건너뛴다 — 응급 상황에서 가장 나쁜 실패다.
   */
  operatingHoursKnown: boolean
}

/** 한 방문 장소와 그 주변 시설 */
export type PlanEmergencySpot = {
  planItemId: string
  placeId: string
  /** 일정 항목 이름 (장소명) */
  title: string
  /** 가까운 순 최대 3곳 */
  facilities: PlanEmergencyFacility[]
}

export type PlanEmergencyDay = {
  /** 1부터 */
  day: number
  spots: PlanEmergencySpot[]
}

/**
 * `GET /plans/{planId}/emergency` — 일정 응급 브리핑 (#125).
 *
 * **출발 전 확인 용도다** (컨트롤러 설명). 급할 때 검색을 시작하면 늦다는 것이 이 기능의
 * 취지라, 화면도 "지금 찾기" 가 아니라 "미리 훑기" 로 만든다.
 *
 * 반경과 개수는 **서버 고정**이다 — 10km · 가까운 순 최대 3곳. 화면이 조절하지 않는다.
 */
export type PlanEmergencyResponse = {
  planId: string
  radiusMeters: number
  days: PlanEmergencyDay[]
}
