/**
 * 반려견 생년월 — 입력 문자열의 형식 규칙 한 곳.
 *
 * 백엔드가 `yyyy-MM` 문자열로 받으므로(`@Pattern`) 하이픈이 값의 일부다. 그런데 사람이
 * 하이픈을 직접 치게 하면 `2026 3` · `2026.03` · `202603` 이 모두 들어오고 그 전부가
 * 400(`PET_104`) 이 된다 — **입력 단계에서 형식으로 만들어 주는 편이 싸다.**
 *
 * 패턴을 `weight.ts` 와 같은 자리(필드별 lib)에 둔다. `schemas.ts` 가 이것을 가져다 쓴다.
 */

/** 백엔드 `PetValidationMessage.BIRTH_YM_PATTERN` 실측 — 문자 하나까지 같아야 한다 */
export const BIRTH_YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** `yyyy-MM` 의 글자 수. `<input maxLength>` 와 아래 자릿수 상한이 같은 값을 쓴다 */
export const BIRTH_YM_LENGTH = 7

/**
 * 형식이 유효한가.
 *
 * **빈 값은 유효하다** — 선택 입력이고, 서버도 `null` 을 통과시킨다. 폼이 들고 있는
 * `''` 는 전송 직전 `toPetSavePayload()` 가 `null` 로 바꾼다 (공통명세 S3-3).
 */
export function isValidBirthYmInput(raw: string): boolean {
  const trimmed = raw.trim()
  return trimmed === '' || BIRTH_YM_PATTERN.test(trimmed)
}

/**
 * 입력 중인 값 → `yyyy-MM` 꼴.
 *
 * 숫자만 남기고 5번째 자리부터 하이픈을 끼운다. **하이픈을 상태로 들고 있지 않는다** —
 * 매 입력마다 숫자에서 다시 만든다. 그래서 `2026-0` 에서 백스페이스를 누르면
 * `2026-` 가 아니라 `2026` 이 되어 지우다 걸리는 자리가 없다.
 *
 * 월 값을 여기서 고치지 않는다 (`13` → `12` 같은 보정). 형식만 맞춰 주고 범위 판정은
 * 스키마가 낸다 — 입력 중에 값이 손에서 바뀌면 사용자가 자기가 뭘 쳤는지 잃는다.
 */
export function formatBirthYmInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 6)
  if (digits.length <= 4) return digits

  return `${digits.slice(0, 4)}-${digits.slice(4)}`
}
