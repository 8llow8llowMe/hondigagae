import { z } from 'zod'

import { messages } from '@/lib/messages'
import { isValidBirthYmInput } from '@/lib/pet/birth-ym'
import { sizeMatchesWeightInput } from '@/lib/pet/size'
import { isValidWeightInput } from '@/lib/pet/weight'
import { ACTIVITY_LEVEL_CODES, PET_SIZE_CODES, SOCIALITY_LEVEL_CODES } from '@/types/pet'

/**
 * 반려견 폼 스키마. **백엔드 제약의 복제본이다** — docs/form-guide.md §5.
 * 필드명은 `PetSaveRequest` 와 같게 둔다. 다르면 서버 오류 매핑이 조용히 깨진다.
 *
 * 검증 대상은 **폼 값**(`PetFormValues`)이다. 요청 본문이 아니다 —
 * `breed`/`birthYm` 이 폼에서는 `''`(빈 값)이고 전송 직전에 `null` 이 된다.
 */

/**
 * 선택 입력의 빈 값을 허용한다.
 *
 * 서버는 `null` 을 통과시키고 `''` 를 거부하는데(`@Pattern` 은 null 만 유효로 본다),
 * 폼은 빈 값을 `''` 로 들고 있다. 여기서 `''` 를 막으면 **선택 입력이 사실상 필수가 된다.**
 * `''` 는 통과시키고, 전송 직전 `toPetSavePayload()` 가 `null` 로 바꾼다
 * (공통명세 S3-3).
 *
 * 패턴 판정은 `lib/pet/birth-ym.ts` 한 곳이 소유한다 — 입력 마스크와 같은 규칙을 봐야
 * 마스크가 만들어 준 값이 스키마에서 떨어지는 일이 없다.
 */
const optionalBirthYm = z.string().refine(isValidBirthYmInput, {
  message: messages.pet.birthYmFormat,
})

export const petFormSchema = z
  .object({
    // PET_101 (필수) / PET_102 (길이)
    name: z.string().trim().min(1, messages.pet.nameRequired).max(20, messages.pet.nameLength),
    // PET_103 — 선택 입력이라 빈 값을 허용한다
    breed: z.string().trim().max(50, messages.pet.breedLength),
    // PET_104 — 규칙만 같다. 문구는 서버 것을 따르지 않는다 (#999, messages.pet.birthYmFormat)
    birthYm: optionalBirthYm,
    /*
      PET_105. **이제 화면에서 닿는다** (#1185) — 등록 폼이 크기를 고르지 않은 채(`''`) 시작한다.
      예전에는 `RadioGroup` 이 늘 값 하나를 들고 있어 2차 방어였다.
    */
    sizeType: z.enum(PET_SIZE_CODES, { message: messages.pet.sizeTypeRequired }),
    /*
    PET_108(범위) · PET_109(소수 자릿수).

    **빈 값을 허용한다.** 백엔드가 선택 필드로 받고, 모르는 것을 억지로 적게 하면
    틀린 값이 들어온다 — 그 값이 장소 필터 판정에 그대로 쓰인다.
    범위·자릿수 판정은 `lib/pet/weight.ts` 한 곳이 소유한다.
  */
    weightKg: z.string().refine(isValidWeightInput, { message: messages.pet.weightInvalid }),
    heatSensitive: z.boolean(),
    coldSensitive: z.boolean(),
    noiseSensitive: z.boolean(),
    // PET_106
    activityLevel: z.enum(ACTIVITY_LEVEL_CODES, { message: messages.pet.activityLevelRequired }),
    walkPreferred: z.boolean(),
    // PET_107
    sociality: z.enum(SOCIALITY_LEVEL_CODES, { message: messages.pet.socialityRequired }),
  })
  /*
    PET_004 — 체중과 크기 구분의 모순 조합 (#369 · BE #364).

    **필드 하나로는 판정할 수 없어 객체 수준에서 본다.** 30kg 소형견이 저장되면 적합도
    판정이 "소형견만 가능" 장소를 동반 가능으로 읽는다.

    **체중을 고치면 크기가 저절로 따라오므로**(`PetForm` 이 `sizeFromWeightInput` 으로
    맞춘다) 이 오류는 사용자가 **크기를 직접 어긋나게 골랐을 때만** 남는다. 그래서
    오류를 `sizeType` 에 붙인다 — 고칠 자리가 그곳이다.

    체중이 비었거나 읽을 수 없으면 어긋남을 판정하지 않는다(백엔드도 그렇다).
  */
  /*
    크기를 아직 고르지 않았으면(`''`, #1185) 어긋남을 판정하지 않는다 — 그 오류는 위 필수 문구가 말한다.
    출력 타입으로는 `''` 이 올 수 없지만, 필드가 실패해도 객체 수준 검사가 도는 경우가 있어(zod 의
    "dirty" 값) 런타임으로 한 번 더 거른다. 거르지 않으면 체중을 적은 채 크기를 비웠을 때 필수 문구 대신
    "체중과 크기가 맞지 않아요" 가 설 수 있다.
  */
  .refine(
    (values) =>
      (values.sizeType as string) === '' ||
      sizeMatchesWeightInput(values.sizeType, values.weightKg),
    {
      message: messages.pet.weightSizeMismatch,
      path: ['sizeType'],
    },
  )
