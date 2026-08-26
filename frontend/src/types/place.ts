import type { EnumMetadata } from '@/types/api'

/**
 * 근거: backend PlaceItem / PlaceDetailResponse (tour-service)
 * 확인 방법: http://localhost:8082/v3/api-docs — 백엔드 미기동 상태에서는 코드 실측 기준이다.
 *
 * 주의
 *  - placeId 는 문자열이다. 백엔드 내부는 long(Snowflake 크기)이지만 응답 DTO가
 *    String 으로 내려준다. number 로 타이핑하면 정밀도가 손상된다.
 *  - 좌표는 백엔드가 이미 lat / lng (Double) 로 정규화했다.
 *    TourAPI 원본의 mapx(경도) / mapy(위도) 문자열이 그대로 오지 않는다.
 *  - contentType / petAllowanceType 은 metadata 객체다. name / description 을 그대로 렌더한다.
 */
export type PlaceSummary = {
  placeId: string
  contentType: EnumMetadata
  title: string
  addr1: string | null
  sigunguCode: string | null
  lat: number | null
  lng: number | null
  firstImage: string | null
  firstImage2: string | null
  petAllowanceType: EnumMetadata
  tel: string | null
}

/** 목록 필터 — 백엔드 PlaceWebController 의 RequestParam 과 이름을 일치시킨다 */
export type PlaceFilters = {
  areaCode: string
  sigunguCode: string | null
  contentType: ContentTypeCode | null
  petAllowanceType: PetAllowanceCode | null
}

/**
 * 백엔드 ContentType enum 의 name().
 * TODO(BE 확인): Spring 기본 바인딩은 name() 기준이므로 `?contentType=TOURIST_SPOT` 을 전제한다.
 * 코드값("12") 바인딩용 컨버터가 있는지 Swagger 로 확인한다.
 */
export const CONTENT_TYPE_CODES = [
  'TOURIST_SPOT',
  'CULTURE',
  'FESTIVAL',
  'COURSE',
  'LEPORTS',
  'LODGING',
  'SHOPPING',
  'RESTAURANT',
] as const
export type ContentTypeCode = (typeof CONTENT_TYPE_CODES)[number]

export const PET_ALLOWANCE_CODES = [
  'ALLOWED',
  'PARTIALLY_ALLOWED',
  'NOT_ALLOWED',
  'UNKNOWN',
] as const
export type PetAllowanceCode = (typeof PET_ALLOWANCE_CODES)[number]
