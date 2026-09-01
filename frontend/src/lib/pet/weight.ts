/**
 * 반려견 체중 — 입력 문자열 ↔ 요청 값 ↔ 장소 필터 값.
 *
 * 값이 세 곳에서 **서로 다른 타입**으로 쓰인다. 변환을 흩으면 반드시 한 곳이 어긋난다.
 *
 * | 자리 | 타입 | 근거 |
 * |------|------|------|
 * | 폼 입력 | `string` | `<input>` 이 들고 있는 값. 빈 값과 `0` 이 다르다 |
 * | `PetSaveRequest.weightKg` | `BigDecimal` (0.1~99.9, 소수 1자리) | 선택 필드 — 모르면 생략 |
 * | `GET /places` 의 `petWeightKg` | **`Integer`** | 소수를 못 받는다 |
 */

/** 백엔드 `@DecimalMin("0.1")` */
export const MIN_PET_WEIGHT_KG = 0.1
/** 백엔드 `@DecimalMax("99.9")` */
export const MAX_PET_WEIGHT_KG = 99.9

/** 소수점 한 자리까지만 (`@Digits(integer = 2, fraction = 1)`) */
const WEIGHT_PATTERN = /^\d{1,2}(\.\d)?$/

/**
 * 폼 문자열이 저장 가능한 값인가.
 *
 * **빈 값은 유효하다** — "모름" 이 정당한 답이기 때문이다. 백엔드도 선택 필드로 받는다.
 */
export function isValidWeightInput(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === '') return true
  if (!WEIGHT_PATTERN.test(trimmed)) return false

  const value = Number(trimmed)
  return value >= MIN_PET_WEIGHT_KG && value <= MAX_PET_WEIGHT_KG
}

/** 폼 문자열 → 요청 값. 빈 값이거나 읽을 수 없으면 `null`(= 보내지 않음) */
export function toWeightPayload(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '' || !WEIGHT_PATTERN.test(trimmed)) return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/** 응답 값 → 폼 문자열. `null`(모름)은 빈 값이다 — `0` 으로 채우지 않는다 */
export function toWeightInput(weightKg: number | null): string {
  return weightKg === null ? '' : String(weightKg)
}

/**
 * 반려견 체중 → 장소 필터 파라미터(`petWeightKg`).
 *
 * **올림이다. 내림이 아니다.**
 *
 * 백엔드 조건은 `maxPetWeightKg IS NULL OR maxPetWeightKg >= petWeightKg` 다
 * (`PlaceCustomRepositoryImpl`). 파라미터가 `Integer` 라 3.5kg 를 그대로 보낼 수 없는데,
 * 내림해서 `3` 을 보내면 **체중 상한이 3kg 인 곳이 통과한다** — 3.5kg 인 아이는 못 들어가는
 * 곳이다. 올림해서 `4` 를 보내면 상한 4kg 이상인 곳만 남아 판정이 안전한 쪽으로 기운다.
 *
 * 필터가 틀리는 두 방향의 비용이 다르다: **못 가는 곳을 보여주는 것**은 현장에서 돌아서게
 * 만들고, **갈 수 있는 곳을 감추는 것**은 선택지가 줄 뿐이다. 반려견 동반 서비스에서는
 * 전자가 훨씬 비싸다.
 */
export function toPlaceFilterWeight(weightKg: number | null): number | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) return null

  return Math.ceil(weightKg)
}
