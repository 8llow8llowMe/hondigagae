import type { LatLng } from '@/lib/geo/coord'
import { PLACES_PATH } from '@/lib/place/places-return'
import { normalizeKeyword } from '@/lib/url/keyword'
import { PET_SIZE_CODES } from '@/types/pet'
import {
  ALLOWED_PET_SIZE_CODES,
  type AllowedPetSizeCode,
  CONTENT_TYPE_CODES,
  type ContentTypeCode,
  PET_ALLOWANCE_CODES,
  type PetAllowanceCode,
  type PlaceFilters,
} from '@/types/place'

/**
 * 장소 목록 필터의 URL 직렬화.
 *
 * 규약 (docs/architecture-guide.md §10)
 *  - 키 이름은 백엔드 RequestParam 과 동일하게 둔다 (매핑 레이어를 없앤다)
 *  - 기본값은 URL 에서 생략한다 → 빈 URL = 기본 상태
 *  - 커서(lastPlaceId)와 size 는 URL 에 넣지 않는다 (공유 대상이 아니다)
 *  - 잘못된 값은 예외를 던지지 않고 기본값으로 떨어뜨린다 (URL 은 사용자가 손으로 고친다)
 */

/** 제주 지역코드. 이 서비스의 기본 지역이다 */
export const DEFAULT_AREA_CODE = '39'

/** 백엔드 기본값과 동일. 허용 범위는 1~50 */
export const PLACE_PAGE_SIZE = 20

export const DEFAULT_PLACE_FILTERS: PlaceFilters = {
  areaCode: DEFAULT_AREA_CODE,
  sigunguCode: null,
  contentType: null,
  petAllowanceType: null,
  indoor: null,
  allowedPetSize: null,
  petSizeType: null,
  petWeightKg: null,
  sourceCategory: null,
  keyword: null,
}

/**
 * **`/places` 의 기본 조건은 `동반 가능만`이다** (#1379). dev 실데이터에서 장소 72% 가 동반 여부
 * `UNKNOWN` 이라, 조건 없는 첫 화면은 반려견 서비스의 목록으로 읽히지 않았다 — 검색 랜딩
 * (`/jeju/[topic]`)이 이미 같은 기준이다.
 *
 * **공용 기본값(`DEFAULT_PLACE_FILTERS`)은 그대로 둔다.** 홈 · 담기 · 코스 주변 · 일정 고르기 시트가
 * 그것을 쓰고, 그쪽 기본값은 각자의 이슈가 정한다(홈 #1380 · 담기 #1383). 그래서 기본값은 화면마다
 * 다를 수 있고, 직렬화 · 파싱이 **어느 화면의 기본값인지** 를 받는다(`placeFilterDefaults`).
 *
 * 빈 URL 이 곧 이 상태라 정규 주소(`/places`, #1130) · sitemap · 입구 링크가 그대로다.
 */
export const PLACES_DEFAULT_FILTERS: PlaceFilters = {
  ...DEFAULT_PLACE_FILTERS,
  petAllowanceType: 'ALLOWED',
}

/**
 * 기본값이 걸린 동반 축을 **사용자가 끈 상태**의 URL 값 — `?petAllowanceType=ALL`.
 *
 * 빈 URL 이 `동반 가능만`인 화면에서 "전체" 를 적을 자리가 따로 없어 두는 화면 전용 값이다.
 * 서버 enum 이 아니므로 **API 쿼리에는 싣지 않는다** — 파싱이 `null`(미지정)로 바꾼다.
 */
export const PET_ALLOWANCE_ANY = 'ALL'

/** 이 경로의 기본 조건. `/places` 만 `동반 가능만`이다 — `PLACES_DEFAULT_FILTERS` 주석 */
export function placeFilterDefaults(pathname: string): PlaceFilters {
  return pathname === PLACES_PATH ? PLACES_DEFAULT_FILTERS : DEFAULT_PLACE_FILTERS
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: RawParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function pickFrom<T extends string>(allowed: readonly T[], value: string | null): T | null {
  if (value === null) return null
  return allowed.includes(value as T) ? (value as T) : null
}

/** boolean 은 `true`/`false` 만 인정하고 그 외에는 미지정(null)으로 떨어뜨린다 */
function readBoolean(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

/**
 * 체중 필터. **정수만 인정한다** — 백엔드 파라미터가 `Integer` 라 소수를 보내면 400 이다.
 * URL 은 사용자가 손으로 고치므로 이상한 값은 예외 없이 미지정으로 떨어뜨린다.
 */
function readWeight(value: string | null): number | null {
  if (value === null || !/^\d{1,3}$/.test(value.trim())) return null

  const weight = Number(value.trim())
  return weight >= 1 && weight <= 100 ? weight : null
}

/**
 * 동반 축. 값이 없으면 그 화면의 기본값, `ALL` 이면 미지정(전체)이다.
 * 모르는 값은 다른 축처럼 기본값으로 떨어뜨린다.
 */
function readPetAllowance(
  value: string | null,
  fallback: PetAllowanceCode | null,
): PetAllowanceCode | null {
  if (value === PET_ALLOWANCE_ANY) return null
  return pickFrom(PET_ALLOWANCE_CODES, value) ?? fallback
}

function readText(value: string | null): string | null {
  return value !== null && value.trim() !== '' ? value.trim() : null
}

/** `defaults` — 이 화면의 기본 조건(`placeFilterDefaults`). 주지 않으면 공용 기본값이다 */
export function parsePlaceFilters(
  params: RawParams,
  defaults: PlaceFilters = DEFAULT_PLACE_FILTERS,
): PlaceFilters {
  const areaCode = read(params, 'areaCode')
  const sigunguCode = read(params, 'sigunguCode')

  return {
    areaCode: areaCode !== null && areaCode.trim() !== '' ? areaCode : DEFAULT_AREA_CODE,
    sigunguCode: sigunguCode !== null && sigunguCode.trim() !== '' ? sigunguCode : null,
    contentType: pickFrom(CONTENT_TYPE_CODES, read(params, 'contentType')),
    petAllowanceType: readPetAllowance(read(params, 'petAllowanceType'), defaults.petAllowanceType),
    indoor: readBoolean(read(params, 'indoor')),
    allowedPetSize: pickFrom(ALLOWED_PET_SIZE_CODES, read(params, 'allowedPetSize')),
    petSizeType: pickFrom(PET_SIZE_CODES, read(params, 'petSizeType')),
    petWeightKg: readWeight(read(params, 'petWeightKg')),
    sourceCategory: readText(read(params, 'sourceCategory')),
    keyword: normalizeKeyword(read(params, 'keyword')),
  }
}

/**
 * 화면 URL 용 쿼리 문자열. 기본값은 생략한다.
 *
 * `defaults` 는 `parsePlaceFilters` 에 준 것과 **같아야 한다** — 다르면 왕복이 깨진다.
 */
export function toPlaceFilterQuery(
  filters: PlaceFilters,
  defaults: PlaceFilters = DEFAULT_PLACE_FILTERS,
): string {
  const params = new URLSearchParams()

  if (filters.areaCode !== DEFAULT_AREA_CODE) params.set('areaCode', filters.areaCode)
  if (filters.sigunguCode !== null) params.set('sigunguCode', filters.sigunguCode)
  if (filters.contentType !== null) params.set('contentType', filters.contentType)
  if (filters.petAllowanceType !== defaults.petAllowanceType) {
    params.set('petAllowanceType', filters.petAllowanceType ?? PET_ALLOWANCE_ANY)
  }
  if (filters.indoor !== null) params.set('indoor', String(filters.indoor))
  if (filters.allowedPetSize !== null) params.set('allowedPetSize', filters.allowedPetSize)
  if (filters.petSizeType !== null) params.set('petSizeType', filters.petSizeType)
  if (filters.petWeightKg !== null) params.set('petWeightKg', String(filters.petWeightKg))
  if (filters.sourceCategory !== null) params.set('sourceCategory', filters.sourceCategory)
  if (filters.keyword !== null) params.set('keyword', filters.keyword)

  return params.toString()
}

/**
 * API 호출용 쿼리 문자열. 기본값도 명시하고 커서·size 를 포함한다.
 *
 * **`origin` 을 주면 `lat` · `lng` 를 함께 싣는다** (#1217) — 서버가 그 점에서 가까운 순으로 주고
 * 행마다 `distanceMeters` 를 채운다. 둘 중 하나만 보내면 `PLACE_109` 400 이라 한 값으로 묶는다.
 * 커서는 거리순에서도 `lastPlaceId` 그대로다(서버가 그 장소의 거리 키를 되살린다).
 * **URL 필터(`toPlaceFilterQuery`)에는 넣지 않는다** — 기준점은 화면이 정하는 것이지 사용자가
 * 고르는 조건이 아니다.
 */
export function toPlaceApiQuery(
  filters: PlaceFilters,
  cursor: string | null = null,
  size: number = PLACE_PAGE_SIZE,
  origin: LatLng | null = null,
): string {
  const params = new URLSearchParams()

  params.set('areaCode', filters.areaCode)
  if (filters.sigunguCode !== null) params.set('sigunguCode', filters.sigunguCode)
  if (filters.contentType !== null) params.set('contentType', filters.contentType)
  if (filters.petAllowanceType !== null) params.set('petAllowanceType', filters.petAllowanceType)
  if (filters.indoor !== null) params.set('indoor', String(filters.indoor))
  if (filters.allowedPetSize !== null) params.set('allowedPetSize', filters.allowedPetSize)
  if (filters.petSizeType !== null) params.set('petSizeType', filters.petSizeType)
  if (filters.petWeightKg !== null) params.set('petWeightKg', String(filters.petWeightKg))
  if (filters.sourceCategory !== null) params.set('sourceCategory', filters.sourceCategory)
  if (filters.keyword !== null) params.set('keyword', filters.keyword)
  if (origin !== null) {
    params.set('lat', String(origin.lat))
    params.set('lng', String(origin.lng))
  }
  if (cursor !== null) params.set('lastPlaceId', cursor)
  params.set('size', String(size))

  return params.toString()
}

export type ContentTypeFilter = ContentTypeCode | null
export type PetAllowanceFilter = PetAllowanceCode | null
export type AllowedPetSizeFilter = AllowedPetSizeCode | null
