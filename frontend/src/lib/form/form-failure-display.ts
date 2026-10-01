import { classify } from '@/lib/api/error'

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
