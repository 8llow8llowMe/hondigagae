import { classify } from '@/lib/api/error'
import type { FormErrors } from '@/lib/form/field-errors'

/**
 * 폼 전체 실패를 **무엇 하나로** 보여 줄지 (#1079).
 *
 * - `temporary` — 5xx · 무응답. 폼 안의 `ErrorState`(재시도 있음) 하나만 선다
 * - `alert` — 입력을 고치거나 기다려야 하는 실패(401 · 409 · 429 · 되돌림 안내). `FormAlert`
 * - `none` — 보여 줄 것이 없다
 *
 * ## 왜 하나만인가
 *
 * 예전에는 5xx 에서 `ErrorState`("잠시 문제가 생겼어요" + 다시 시도) 아래에 `FormAlert`(서버
 * 문구)가 **또** 섰다. `apiErrorToFormErrors` 가 5xx 에도 `form` 을 채우기 때문이다. 같은 실패를
 * 두 번 말하고, `ErrorState` 의 세로 여백까지 얹혀 375 에서 폼이 약 250px 밀려 소셜 버튼이
 * 접힘선 밑으로 갔다.
 *
 * **판정은 상태 코드가 한다** — 문구가 없어도(무응답) 5xx 면 `temporary` 다. 429 는
 * `classify` 가 `'rate-limited'` 로 보므로 여기 걸리지 않는다: 재시도 버튼은 잠금을 연장한다.
 *
 * 표시(`FormFailure`)와 제출 실패 뒤 포커스(`submitFailureFocusTargets`)가 **이 함수 하나를**
 * 본다 — 둘이 따로 판정하면 숨긴 알림으로 포커스를 보내는 어긋남이 다시 생긴다.
 */
export type FormFailureDisplay =
  { kind: 'temporary' } | { kind: 'alert'; message: string } | { kind: 'none' }

export function formFailureDisplay(
  formMessage: string | null,
  errorStatus: number | null,
): FormFailureDisplay {
  if (errorStatus !== null && classify(errorStatus) === 'temporary') return { kind: 'temporary' }
  if (formMessage !== null) return { kind: 'alert', message: formMessage }
  return { kind: 'none' }
}

/**
 * **값을 고친 순간 남길 폼 오류** — 일시 장애였으면 폼 전체 문구를 함께 걷는다 (#1102).
 *
 * 값을 고치면 호출부가 `errorStatus` 를 비워 일시 장애를 걷는다(로그인 D4 · 등록 D4). 그런데
 * 5xx 에도 `apiErrorToFormErrors` 가 `form` 에 서버 문구를 채워 두므로, 상태만 비우면
 * `formFailureDisplay(문구, null)` 이 그 문구로 알림을 세웠다 — 일시 장애가 "서비스를 일시적으로
 * 사용할 수 없습니다." 알림으로 **모양을 바꿔** 남았다.
 *
 * ## 왜 표시 판정(`formFailureDisplay`)이 아니라 여기서인가
 *
 * 표시 함수가 받는 `(문구, null)` 은 두 상황이 같은 모양이다 — "5xx 뒤 값을 고쳤다"(걷어야
 * 한다)와 "401 · 429 뒤 값을 고쳤다 / 되돌림 안내"(남겨야 한다). 어느 쪽인지 아는 순간은 상태를
 * 비우기 **직전**뿐이라, 그 자리에서 이 함수로 문구를 함께 걷는다. 판정 기준은 여전히
 * `formFailureDisplay` 하나다 — 일시 장애로 보이던 것만 걷는다.
 *
 * **재시도 전까지 아무것도 서지 않는다.** 5xx 문구는 원래 화면에 그려진 적이 없다(일시 장애가
 * 대신 섰다). 걷어도 잃는 정보가 없고, 다시 내면 결과가 다시 선다.
 *
 * 필드 오류는 건드리지 않는다 — 고친 필드만 지우는 것은 `setValue` 의 몫이다. 걷을 것이 없으면
 * **같은 객체**를 돌려준다 — 입력마다 부르는 `setErrors` 가 렌더를 건너뛴다.
 */
export function formErrorsAfterEdit(errors: FormErrors, errorStatus: number | null): FormErrors {
  if (errors.form === null) return errors
  if (formFailureDisplay(errors.form, errorStatus).kind !== 'temporary') return errors
  return { fields: errors.fields, form: null }
}
