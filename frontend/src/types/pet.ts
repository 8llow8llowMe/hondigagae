import type { EnumMetadata } from '@/types/api'

/**
 * 반려견 프로필.
 *
 * 근거: backend `PetItem` / `PetResponse` (auth-service pet 컨텍스트).
 * 확인 방법: http://localhost:8081/v3/api-docs — 백엔드 미기동 상태에서는 소스 실측 기준이다.
 * 계약 상세는 docs/features/pet/공통명세.md.
 *
 * 주의
 *  - `petId` 는 문자열이다. 백엔드 내부는 long(Snowflake)이고 응답 DTO 가 String 으로
 *    내려준다. number 로 타이핑하면 정밀도가 손상된다.
 *  - **경로 파라미터는 `long` 이다.** 숫자가 아닌 petId 는 404 가 아니라 400(`PET_113`) 이다.
 *  - enum 3종은 응답에서 metadata 객체다. 요청에서는 code 문자열이다 — 표현이 다르다
 *    (공통명세 S3-5). 변환은 src/lib/pet/form.ts 한 곳에서만 한다.
 *  - `age` 는 서버가 `birthYm` 으로 계산한다. FE 가 계산하지 않는다.
 */
export type Pet = {
  petId: string
  name: string
  breed: string | null
  birthYm: string | null
  age: number | null
  sizeType: EnumMetadata
  heatSensitive: boolean
  coldSensitive: boolean
  noiseSensitive: boolean
  activityLevel: EnumMetadata
  walkPreferred: boolean
  sociality: EnumMetadata
}

/** `GET /members/me/pets` — SliceResponse 가 아니다. 최대 5마리라 항상 전량이 온다 */
export type PetList = {
  pets: Pet[]
  totalCount: number
}

/**
 * 선택지 code 목록.
 *
 * **열거 API 가 없어 하드코딩한다.** 응답 metadata 는 이미 선택된 값 하나뿐이므로
 * 등록 폼의 선택지를 서버에서 받을 수 없다 (공통명세 S6-1 에 BE 요청으로 남겼다).
 * 근거: backend shared-travel `PetSizeType` / `ActivityLevel` / `SocialityLevel`.
 */
export const PET_SIZE_CODES = ['SMALL', 'MEDIUM', 'LARGE'] as const
export type PetSizeCode = (typeof PET_SIZE_CODES)[number]

export const ACTIVITY_LEVEL_CODES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type ActivityLevelCode = (typeof ACTIVITY_LEVEL_CODES)[number]

export const SOCIALITY_LEVEL_CODES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type SocialityLevelCode = (typeof SOCIALITY_LEVEL_CODES)[number]

/**
 * 등록·수정 요청 본문. `PetSaveRequest` 를 등록과 수정이 공유한다.
 *
 * **PATCH 의미가 아니다.** 수정에서 필드를 빼면 그 값으로 통째로 덮어써진다
 * (`PetCommandProcessor.update()`). 항상 10개 필드를 다 보낸다.
 *
 * `breed`/`birthYm` 이 `null` 을 허용하는 이유는 공통명세 S3-3 을 봐야 한다 —
 * `birthYm` 은 빈 문자열이면 400 이다.
 */
export type PetSavePayload = {
  name: string
  breed: string | null
  birthYm: string | null
  sizeType: PetSizeCode
  heatSensitive: boolean
  coldSensitive: boolean
  noiseSensitive: boolean
  activityLevel: ActivityLevelCode
  walkPreferred: boolean
  sociality: SocialityLevelCode
}

/**
 * 폼이 들고 있는 값. `PetSavePayload` 와 다르다.
 *
 * `breed`/`birthYm` 이 `string` 인 이유: `<input value>` 는 controlled 계약상
 * `null` 을 받을 수 없다 (component-guide.md §5). 빈 값은 폼에서 `''` 로 두고
 * 전송 직전에 `null` 로 바꾼다 — `toPetSavePayload()`.
 */
export type PetFormValues = {
  name: string
  breed: string
  birthYm: string
  sizeType: PetSizeCode
  heatSensitive: boolean
  coldSensitive: boolean
  noiseSensitive: boolean
  activityLevel: ActivityLevelCode
  walkPreferred: boolean
  sociality: SocialityLevelCode
}
