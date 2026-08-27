import { z } from 'zod'

import { messages } from '@/lib/messages'
import { ACTIVITY_LEVEL_CODES, PET_SIZE_CODES, SOCIALITY_LEVEL_CODES } from '@/types/pet'

/**
 * 반려견 폼 스키마. **백엔드 제약의 복제본이다** — docs/form-guide.md §5.
 * 필드명은 `PetSaveRequest` 와 같게 둔다. 다르면 서버 오류 매핑이 조용히 깨진다.
 *
 * 검증 대상은 **폼 값**(`PetFormValues`)이다. 요청 본문이 아니다 —
 * `breed`/`birthYm` 이 폼에서는 `''`(빈 값)이고 전송 직전에 `null` 이 된다.
 */

/** PetValidationMessage.BIRTH_YM_PATTERN 실측 — 백엔드와 문자 하나까지 같아야 한다 */
const BIRTH_YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * 선택 입력의 빈 값을 허용한다.
 *
 * 서버는 `null` 을 통과시키고 `''` 를 거부하는데(`@Pattern` 은 null 만 유효로 본다),
 * 폼은 빈 값을 `''` 로 들고 있다. 여기서 `''` 를 막으면 **선택 입력이 사실상 필수가 된다.**
 * `''` 는 통과시키고, 전송 직전 `toPetSavePayload()` 가 `null` 로 바꾼다
 * (공통명세 S3-3).
 */
const optionalBirthYm = z
  .string()
  .refine((value) => value.trim() === '' || BIRTH_YM_PATTERN.test(value.trim()), {
    message: messages.pet.birthYmFormat,
  })

export const petFormSchema = z.object({
  // PET_101 (필수) / PET_102 (길이)
  name: z.string().trim().min(1, messages.pet.nameRequired).max(20, messages.pet.nameLength),
  // PET_103 — 선택 입력이라 빈 값을 허용한다
  breed: z.string().trim().max(50, messages.pet.breedLength),
  // PET_104
  birthYm: optionalBirthYm,
  // PET_105 — RadioGroup 이 값을 고정하므로 실질적으로는 2차 방어다
  sizeType: z.enum(PET_SIZE_CODES, { message: messages.pet.sizeTypeRequired }),
  heatSensitive: z.boolean(),
  coldSensitive: z.boolean(),
  noiseSensitive: z.boolean(),
  // PET_106
  activityLevel: z.enum(ACTIVITY_LEVEL_CODES, { message: messages.pet.activityLevelRequired }),
  walkPreferred: z.boolean(),
  // PET_107
  sociality: z.enum(SOCIALITY_LEVEL_CODES, { message: messages.pet.socialityRequired }),
})
