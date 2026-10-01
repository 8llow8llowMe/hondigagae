import type { FormErrors } from '@/lib/form/field-errors'

/** 인증코드 칸의 필드 이름 — 가입 2단계(`CodeValues`) · 재설정 2단계(`PasswordResetValues`) 공통 */
const CODE_FIELD = 'code'

/**
 * 재전송(`다시 보내기`)이 어떻게 끝났는가.
 *
 * - `sent` — 새 코드가 발송됐다
 * - `failed` + `failure` — 429. 서버 문구를 폼 전체 실패로 얹는다(`apiErrorToFormErrors` 결과)
 * - `failed` + `failure: null` — 5xx · 무응답. 표시는 상태 코드가 일시 장애로 세운다
 */
export type ResendOutcome = { result: 'sent' } | { result: 'failed'; failure: FormErrors | null }

/**
 * 재전송이 끝난 뒤 코드 단계에 남길 것.
 *
 * `errors` 가 값이 아니라 **이전 오류를 받는 함수**인 이유: 재전송 콜백은 요청 전에 만들어져
 * 그 안의 `errors` 가 낡았다. `useForm.setErrors` 에 그대로 넘긴다 (#1102).
 */
export type CodeStepAfterResend = {
  /** 코드 칸 값을 비우는가 */
  clearCode: boolean
  errors: (previous: FormErrors) => FormErrors
}

/**
 * **재전송 결과가 코드 칸의 오류 · 값에 무엇을 하는가** (#1109). 가입 · 재설정 2단계가 이 판정
 * 하나를 쓴다.
 *
 * ## 성공이면 코드 칸 오류와 값을 함께 걷는다 (사용자 결정 2026-10-01)
 *
 * 틀린 코드(`AUTH_004`) 뒤 재전송이 성공하면 옛 코드는 더 이상 유효하지 않다. "인증코드가
 * 일치하지 않습니다" 가 남으면 새 코드를 받은 칸이 여전히 틀린 것처럼 읽히고, 칸에 남은 값은
 * 무효가 된 코드다. 직전 폼 전체 실패(429 · 5xx 문구, #1102)도 같이 걷는다.
 *
 * **코드 칸이 아닌 필드 오류는 남긴다** — 재설정의 새 비밀번호 오류는 재전송과 무관하다.
 *
 * ## 실패면 코드 칸은 그대로다
 *
 * 429 · 5xx · 무응답이면 새 코드가 오지 않았다. 앞서 받은 코드가 여전히 유효하므로 그 오류와
 * 값을 지울 이유가 없다. 429 는 서버 문구를 폼 전체 실패로 **얹는다** — 예전처럼 오류를 통째로
 * 바꾸면 코드 칸 오류가 함께 사라졌다.
 */
export function codeStepAfterResend(outcome: ResendOutcome): CodeStepAfterResend {
  if (outcome.result === 'sent') {
    return { clearCode: true, errors: clearCodeErrors }
  }
  const { failure } = outcome
  if (failure === null) {
    return { clearCode: false, errors: keepErrors }
  }
  return {
    clearCode: false,
    errors: (previous) => ({
      fields: { ...previous.fields, ...failure.fields },
      form: failure.form,
    }),
  }
}

/** 걷을 것이 없으면 같은 객체를 돌려준다 — `setErrors` 가 렌더를 건너뛴다 */
function clearCodeErrors(previous: FormErrors): FormErrors {
  if (previous.form === null && previous.fields[CODE_FIELD] === undefined) return previous
  const fields = { ...previous.fields }
  delete fields[CODE_FIELD]
  return { fields, form: null }
}

function keepErrors(previous: FormErrors): FormErrors {
  return previous
}
