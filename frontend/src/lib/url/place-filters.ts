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
  sourceCategory: null,
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

function readText(value: string | null): string | null {
  return value !== null && value.trim() !== '' ? value.trim() : null
}

export function parsePlaceFilters(params: RawParams): PlaceFilters {
  const areaCode = read(params, 'areaCode')
  const sigunguCode = read(params, 'sigunguCode')

  return {
    areaCode: areaCode !== null && areaCode.trim() !== '' ? areaCode : DEFAULT_AREA_CODE,
    sigunguCode: sigunguCode !== null && sigunguCode.trim() !== '' ? sigunguCode : null,
    contentType: pickFrom(CONTENT_TYPE_CODES, read(params, 'contentType')),
    petAllowanceType: pickFrom(PET_ALLOWANCE_CODES, read(params, 'petAllowanceType')),
    indoor: readBoolean(read(params, 'indoor')),
    allowedPetSize: pickFrom(ALLOWED_PET_SIZE_CODES, read(params, 'allowedPetSize')),
    sourceCategory: readText(read(params, 'sourceCategory')),
  }
}

/** 화면 URL 용 쿼리 문자열. 기본값은 생략한다 */
export function toPlaceFilterQuery(filters: PlaceFilters): string {
  const params = new URLSearchParams()

  if (filters.areaCode !== DEFAULT_AREA_CODE) params.set('areaCode', filters.areaCode)
  if (filters.sigunguCode !== null) params.set('sigunguCode', filters.sigunguCode)
  if (filters.contentType !== null) params.set('contentType', filters.contentType)
  if (filters.petAllowanceType !== null) params.set('petAllowanceType', filters.petAllowanceType)
  if (filters.indoor !== null) params.set('indoor', String(filters.indoor))
  if (filters.allowedPetSize !== null) params.set('allowedPetSize', filters.allowedPetSize)
  if (filters.sourceCategory !== null) params.set('sourceCategory', filters.sourceCategory)

  return params.toString()
}

/** API 호출용 쿼리 문자열. 기본값도 명시하고 커서·size 를 포함한다 */
export function toPlaceApiQuery(
  filters: PlaceFilters,
  cursor: string | null = null,
  size: number = PLACE_PAGE_SIZE,
): string {
  const params = new URLSearchParams()

  params.set('areaCode', filters.areaCode)
  if (filters.sigunguCode !== null) params.set('sigunguCode', filters.sigunguCode)
  if (filters.contentType !== null) params.set('contentType', filters.contentType)
  if (filters.petAllowanceType !== null) params.set('petAllowanceType', filters.petAllowanceType)
  if (filters.indoor !== null) params.set('indoor', String(filters.indoor))
  if (filters.allowedPetSize !== null) params.set('allowedPetSize', filters.allowedPetSize)
  if (filters.sourceCategory !== null) params.set('sourceCategory', filters.sourceCategory)
  if (cursor !== null) params.set('lastPlaceId', cursor)
  params.set('size', String(size))

  return params.toString()
}

export type ContentTypeFilter = ContentTypeCode | null
export type PetAllowanceFilter = PetAllowanceCode | null
export type AllowedPetSizeFilter = AllowedPetSizeCode | null
