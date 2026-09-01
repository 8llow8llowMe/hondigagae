import { toWeightInput, toWeightPayload } from '@/lib/pet/weight'
import {
  ACTIVITY_LEVEL_CODES,
  type ActivityLevelCode,
  type Pet,
  PET_SIZE_CODES,
  type PetFormValues,
  type PetSavePayload,
  type PetSizeCode,
  SOCIALITY_LEVEL_CODES,
  type SocialityLevelCode,
} from '@/types/pet'

/**
 * 반려견 폼 값 ↔ API 요청/응답 변환.
 *
 * **변환을 이 파일 밖으로 흩지 않는다.** 백엔드 계약에 서로 반대 방향의 함정이 두 개 있어
 * (docs/features/pet/공통명세.md S3-3 / S3-5) 필드별로 처리하면 한 곳을 반드시 놓친다.
 */

/**
 * 등록 폼 초기값.
 *
 * boolean 4개를 `false` 로 두는 이유: 서버가 primitive `boolean` 이라 필드를 빼면
 * 조용히 `false` 가 된다 (S3-4). 폼 기본값을 서버 기본값과 같게 맞춰
 * "폼에 보이는 것"과 "저장되는 것"이 어긋나지 않게 한다.
 */
export const EMPTY_PET_FORM_VALUES: PetFormValues = {
  name: '',
  breed: '',
  birthYm: '',
  sizeType: 'SMALL',
  // 빈 값이 곧 "모름" 이다. 0 으로 채우면 서버가 400(PET_108) 을 낸다
  weightKg: '',
  heatSensitive: false,
  coldSensitive: false,
  noiseSensitive: false,
  activityLevel: 'MEDIUM',
  walkPreferred: false,
  sociality: 'MEDIUM',
}

export function isPetSizeCode(value: string): value is PetSizeCode {
  return (PET_SIZE_CODES as readonly string[]).includes(value)
}

export function isActivityLevelCode(value: string): value is ActivityLevelCode {
  return (ACTIVITY_LEVEL_CODES as readonly string[]).includes(value)
}

export function isSocialityLevelCode(value: string): value is SocialityLevelCode {
  return (SOCIALITY_LEVEL_CODES as readonly string[]).includes(value)
}

/**
 * 빈 값을 `null` 로 만든다.
 *
 * `birthYm` 에는 필수다 — Jakarta `@Pattern` 은 `null` 을 유효로 보지만 `''` 는
 * 정규식에 걸려 400(`PET_104`) 이 된다. `breed` 는 `''` 도 서버가 받아주지만
 * 목록 카드에 빈 배지를 그리게 되므로 같이 `null` 로 보낸다 (S3-3).
 */
function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 폼 값 → 요청 본문.
 *
 * 11개 필드를 **전부** 담는다. `PUT` 이 부분 수정이 아니라 통째로 덮어쓰기이므로
 * (S2) 빠진 필드는 값을 지우는 것과 같다.
 */
export function toPetSavePayload(values: PetFormValues): PetSavePayload {
  return {
    name: values.name.trim(),
    breed: blankToNull(values.breed),
    birthYm: blankToNull(values.birthYm),
    sizeType: values.sizeType,
    weightKg: toWeightPayload(values.weightKg),
    heatSensitive: values.heatSensitive,
    coldSensitive: values.coldSensitive,
    noiseSensitive: values.noiseSensitive,
    activityLevel: values.activityLevel,
    walkPreferred: values.walkPreferred,
    sociality: values.sociality,
  }
}

/**
 * 응답 → 폼 값.
 *
 * 응답의 enum 은 `{code, name, description}` 객체이고 요청은 code 문자열이다 (S3-5).
 * 이 변환을 놓치면 수정 저장이 조용히 깨진다.
 *
 * 알 수 없는 code 는 초기값으로 떨어뜨린다. 백엔드 enum 에 값이 추가되면 FE 가
 * 조용히 낡는데(S6-1), 폼이 깨지는 것보다 기본값을 보여주는 편이 복구 가능하다.
 */
export function toPetFormValues(pet: Pet): PetFormValues {
  const sizeType = pet.sizeType.code
  const activityLevel = pet.activityLevel.code
  const sociality = pet.sociality.code

  return {
    name: pet.name,
    breed: pet.breed ?? '',
    birthYm: pet.birthYm ?? '',
    sizeType: isPetSizeCode(sizeType) ? sizeType : EMPTY_PET_FORM_VALUES.sizeType,
    weightKg: toWeightInput(pet.weightKg),
    heatSensitive: pet.heatSensitive,
    coldSensitive: pet.coldSensitive,
    noiseSensitive: pet.noiseSensitive,
    activityLevel: isActivityLevelCode(activityLevel)
      ? activityLevel
      : EMPTY_PET_FORM_VALUES.activityLevel,
    walkPreferred: pet.walkPreferred,
    sociality: isSocialityLevelCode(sociality) ? sociality : EMPTY_PET_FORM_VALUES.sociality,
  }
}
