import type { FormErrors } from '@/lib/form/field-errors'
import { focusFirstError, hasFieldErrors } from '@/lib/form/focus-first-error'
import { formFailureDisplay } from '@/lib/form/form-failure-display'

/**
 * 폼 전체 오류 알림(`FormAlert`)을 찾는 선택자. `FormAlert` 가 이 속성을 단다.
 *
 * `role="alert"` 로 찾지 않는다 — `next dev` 오버레이 · 다른 컴포넌트도 그 역할을 쓴다.
 */
export const FORM_ALERT_SELECTOR = '[data-form-alert]'

/**
 * 폼 안 일시 장애 표시(`FormFailure` 의 `temporary` 갈래)를 찾는 선택자 (#1079).
 *
 * 5xx 에서는 `FormAlert` 가 서지 않으므로 알림 선택자로는 찾지 못한다.
 */
export const FORM_TEMPORARY_ERROR_SELECTOR = '[data-form-temporary-error]'

/**
 * 마지막 기댈 곳 — 폼 안의 첫 입력. 동의 블록처럼 `<form>` 밖에 있는 컨트롤은 고르지 않는다.
 */
const FIRST_INPUT_SELECTOR = [
  'form input:not([disabled]):not([type="hidden"])',
  'form textarea:not([disabled])',
  'form select:not([disabled])',
].join(', ')

/**
 * - `field` — 화면에서 첫 번째로 보이는 오류 필드 (`focusFirstError`)
 * - `alert` — 폼 전체 오류 알림 (`FormAlert`)
 * - `temporary` — 폼 안 일시 장애 표시 (5xx · 무응답, #1079)
 * - `input` — 폼의 첫 입력
 */
export type SubmitFailureFocusTarget = 'field' | 'alert' | 'temporary' | 'input'

/**
 * 제출이 실패한 뒤 포커스를 **어디에 어떤 순서로** 시도하는가 (#1078).
 *
 * ## 왜 이것이 필요한가
 *
 * 제출 중에는 버튼이 `disabled` 다. 포커스를 쥔 요소가 비활성이 되면 브라우저는 포커스를
 * `BODY` 로 떨어뜨리고, 실패해서 버튼이 다시 살아나도 돌려주지 않는다. 그래서 필드 오류가 없는
 * 실패 — 5xx · 429 · `MEMBER_007` · 409 처럼 폼 전체 오류로만 오는 것 — 뒤에는 키보드 사용자가
 * 문서 맨 위에서 다시 시작했다 (2026-10-01 실측: 로그인 503 · 429 · `MEMBER_007`, 가입 409).
 *
 * ## 순서
 *
 * 1. **필드 오류가 있으면 그 필드** — 고칠 자리다 (form-guide.md §8).
 * 2. **폼 전체 실패가 있으면 그 표시** — 읽어야 할 문장이다. 무엇을 고칠지는 문장이 말한다.
 *    5xx · 무응답이면 `FormAlert` 가 아니라 폼 안 일시 장애 표시다 (#1079). 무엇이 서는지는
 *    `formFailureDisplay` 가 정하고, 화면(`FormFailure`)도 같은 함수를 본다.
 * 3. **그래도 못 옮겼으면 폼의 첫 입력** — `BODY` 보다는 낫다.
 *
 * **일시 장애에서 재시도 버튼이 아니라 표시 전체로 간다.** 오프라인이면 그 버튼이 걷히고
 * (`ErrorStateView`), 버튼으로 가면 스크린리더가 "다시 시도" 만 읽어 무엇이 실패했는지 모른다.
 * 다음 Tab 이 재시도 버튼이다.
 *
 * `errorStatus` 를 안 넘기면(`null`) 예전 순서 그대로다 — 상태를 따로 들지 않는 폼용.
 */
export function submitFailureFocusTargets(
  errors: FormErrors,
  errorStatus: number | null = null,
): SubmitFailureFocusTarget[] {
  const targets: SubmitFailureFocusTarget[] = []
  if (hasFieldErrors(errors)) targets.push('field')
  const display = formFailureDisplay(errors.form, errorStatus)
  if (display.kind === 'temporary') targets.push('temporary')
  if (display.kind === 'alert') targets.push('alert')
  targets.push('input')
  return targets
}

const TARGET_SELECTOR: Record<Exclude<SubmitFailureFocusTarget, 'field'>, string> = {
  alert: FORM_ALERT_SELECTOR,
  temporary: FORM_TEMPORARY_ERROR_SELECTOR,
  input: FIRST_INPUT_SELECTOR,
}

function focusSelector(container: HTMLElement, selector: string): boolean {
  const target = container.querySelector<HTMLElement>(selector)
  if (target === null) return false
  target.focus()
  return true
}

/**
 * `submitFailureFocusTargets` 의 순서대로 시도해 처음 성공한 곳에 포커스를 둔다.
 * 옮겼으면 `true`.
 *
 * **언제 부를지는 호출부의 `submitCount` effect 가 정한다** — `focusFirstError` 와 같은
 * 규칙이다 (`use-form.ts` 의 `submitCount` JSDoc). `errors` 는 그 제출의 표시 오류를 넘긴다:
 * 화면이 오류를 가공해 보여 주면(되돌림 안내 · 동의 오류) 가공한 쪽이다. `errorStatus` 는
 * 화면이 `FormFailure` 에 넘기는 것과 같은 값이다.
 */
export function focusSubmitFailure(
  container: HTMLElement | null | undefined,
  errors: FormErrors,
  errorStatus: number | null = null,
): boolean {
  if (container === null || container === undefined) return false

  for (const target of submitFailureFocusTargets(errors, errorStatus)) {
    const moved =
      target === 'field'
        ? focusFirstError(container, errors)
        : focusSelector(container, TARGET_SELECTOR[target])
    if (moved) return true
  }
  return false
}
