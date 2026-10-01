/**
 * 이메일 인증코드 정규화 — 회원가입 2단계와 비밀번호 재설정이 같이 쓴다 (#1078).
 *
 * ## 왜 FE 가 고치나
 *
 * 백엔드는 코드를 **대문자 + 숫자 8자**로만 만들고(`VerificationCodeGenerator` —
 * `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), **대소문자를 가려** 비교한다
 * (`EmailVerificationProcessor` · `PasswordResetProcessor` 의 `storedCode.equals(code)`).
 * 그래서 `' a3k7mp2x '` 처럼 소문자 · 공백이 섞이면 맞는 코드인데도 늘 "일치하지 않습니다" 다.
 * 재설정은 5번 틀리면 코드가 무효화된다(`AUTH_017`) — 맞는 코드로 기회를 다 쓰게 된다.
 *
 * 코드에 소문자와 공백은 원래 없으므로, 둘을 지워도 맞는 코드를 틀리게 만드는 일은 없다.
 *
 * ## 언제 고치나 — 입력 중에 바로 (사용자 결정 2026-10-01)
 *
 * 화면에 보이는 값과 보내는 값이 같아야 사용자가 무엇을 보냈는지 안다. 제출 직전 스키마에서도
 * **같은 함수로** 한 번 더 고친다 — 프로그램이 값을 넣는 경로(자동완성 등)가 입력 핸들러를
 * 건너뛰어도 보내는 값은 같게 (`schemas.ts`).
 */

/** 백엔드 `VerificationCodeGenerator.CODE_LENGTH` */
export const VERIFICATION_CODE_LENGTH = 8

/*
  `\s` 는 탭 · 줄바꿈 · 전각 공백(U+3000) · NBSP 까지 덮는다. 메일 본문에서 코드를 끌어 복사하면
  앞뒤 줄바꿈이나 NBSP 가 딸려 온다.
*/
const WHITESPACE = /\s/g

/**
 * 공백을 지우고 대문자로 바꾼 뒤 **8자까지만** 남긴다.
 *
 * **자르기는 공백을 지운 뒤다.** 그래서 입력란에 네이티브 `maxLength` 를 걸지 않는다 —
 * 브라우저는 붙여넣은 글자를 `maxlength` 로 **먼저** 자르고 나서 입력 이벤트를 준다.
 * `' a3k7mp2x'`(9자)를 붙여넣으면 `' a3k7mp2'` 가 되어, 정규화해도 7자짜리 틀린 코드가 남는다.
 */
export function normalizeVerificationCode(raw: string): string {
  return raw.replace(WHITESPACE, '').toUpperCase().slice(0, VERIFICATION_CODE_LENGTH)
}

export type NormalizedCodeInput = {
  value: string
  /** 정규화한 값 안에서 커서가 있어야 할 자리. 원래 커서를 몰랐으면 `null` */
  caret: number | null
}

/**
 * 입력 이벤트용 — 값과 함께 **커서 자리**를 돌려준다.
 *
 * 제어 입력의 값을 바꿔 쓰면(`ab` → `AB`) 브라우저는 커서를 끝으로 보낸다. 가운데를 고치던
 * 사람의 커서가 튀지 않게, "커서 앞에 있던 글자들이 정규화 뒤 몇 자가 되는가" 로 새 자리를
 * 센다. 커서 앞의 공백이 지워지면 그만큼 당겨진다.
 */
export function normalizeVerificationCodeInput(
  raw: string,
  caret: number | null,
): NormalizedCodeInput {
  const value = normalizeVerificationCode(raw)
  if (caret === null) return { value, caret: null }

  const before = normalizeVerificationCode(raw.slice(0, caret)).length
  return { value, caret: Math.min(before, value.length) }
}
