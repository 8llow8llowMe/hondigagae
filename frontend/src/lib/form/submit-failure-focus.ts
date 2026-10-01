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

/**
 * 폼 전체 실패 표시가 **무엇으로 읽히는가** (#1102).
 *
 * - `live` — `role="alert"`. 나타나는 순간 스크린리더가 읽는다. 포커스는 다른 곳(오류 필드 ·
 *   비밀번호 칸 · 되돌아간 단계의 첫 입력)으로 간다
 * - `focus` — 역할 없음. 포커스가 그 표시로 옮겨 가며 읽힌다
 */
export type FailureAnnounce = 'live' | 'focus'

/**
 * 제출 실패 표시를 `live` 로 둘지 `focus` 로 둘지 — **포커스 순서의 첫 대상이 그 표시인가** (#1102).
 *
 * ## 왜 하나만인가
 *
 * #1078 이 `FormAlert` · 일시 장애 상자를 제출 실패 뒤 포커스 대상으로 만들면서 두 표시가
 * `role="alert"` 이면서 포커스도 받게 됐다. 알림은 나타나는 순간 읽히고, 곧이어 포커스가 옮겨
 * 오며 같은 문구를 또 읽는다 — 이중 낭독이다(실측: 로그인 429 · 503 뒤 `activeElement` 가
 * `role="alert"` 요소 자신이었다).
 *
 * **포커스를 남기고 역할을 뗀다.** 반대(포커스를 주지 않고 알림만)로 가면 #1078 이 막은
 * `BODY` 낙하가 돌아오고, 포커스를 다른 칸으로 보내면 그 칸의 이름이 알림을 끊고 들어온다.
 * 포커스는 키보드 사용자에게도 "지금 여기" 를 보여 준다.
 *
 * **판정은 `submitFailureFocusTargets` 의 첫 대상이다** — effect 가 실제로 포커스를 보내는 곳과
 * 같은 함수를 봐야 "역할을 뗐는데 포커스도 안 간" 무음 실패가 생기지 않는다. 필드 오류가 먼저면
 * 포커스는 필드로 가므로 표시는 `live` 다(반려견 폼의 "N개 확인" 요약).
 *
 * **호출부가 포커스를 다른 데로 보내는 갈래는 `live` 로 덮는다** — 로그인 401(비밀번호 칸,
 * 로그인 D4)과 단계 되돌림 안내(단계 전환 effect 가 새 단계의 첫 입력으로 옮긴다, D6).
 */
export function submitFailureAnnounce(
  errors: FormErrors,
  errorStatus: number | null = null,
): FailureAnnounce {
  const [first] = submitFailureFocusTargets(errors, errorStatus)
  return first === 'alert' || first === 'temporary' ? 'focus' : 'live'
}

/** 재전송 결과 — 성공(`sent`)이거나 막혔거나(`failed`: 429 · 5xx · 무응답) */
export type ResendResult = 'sent' | 'failed'

/**
 * 재전송(`다시 보내기`)이 끝난 뒤 포커스를 **어디에 어떤 순서로** 시도하는가 (#1102).
 *
 * 재전송 버튼은 요청 중 `loading`(= `disabled`)이고, 끝나면 성공이든 429 든 쿨다운으로 다시
 * `disabled` 다. 포커스를 쥔 버튼이 비활성이 되면 포커스가 `BODY` 로 떨어진다 — 실측(Playwright)
 * 에서 가입 · 재설정 2단계 모두 성공 · 429 · 503 세 갈래가 `BODY` 였다. 제출이 아니라
 * `submitCount` 경로 밖이라 `focusSubmitFailure` 가 닿지 않았다.
 *
 * - **`sent` → 폼의 첫 입력**(두 화면 다 코드 칸). 다음 할 일은 새 코드를 넣는 것이다 — 단계
 *   전환이 새 단계의 첫 입력으로 가는 것(D6)과 같은 판단이다. 성공 안내(`FormNotice`)로 보내지
 *   않는다: 안내 문구는 바뀌지 않아 다시 읽힐 것이 없고, 쿨다운 진입은 버튼 옆 `aria-live` 가
 *   "다시 보내기 (60초 후 가능)" 으로 이미 알린다.
 * - **`failed` → 제출 실패와 같은 순서** — 429 는 알림, 5xx · 무응답은 일시 장애 상자.
 */
export function resendFocusTargets(
  result: ResendResult,
  errors: FormErrors,
  errorStatus: number | null,
): SubmitFailureFocusTarget[] {
  if (result === 'sent') return ['input']
  return submitFailureFocusTargets(errors, errorStatus)
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
  return focusTargets(container, submitFailureFocusTargets(errors, errorStatus), errors)
}

/**
 * `resendFocusTargets` 의 순서대로 시도한다 (#1102). 옮겼으면 `true`.
 *
 * **성공(`sent`)은 포커스를 잃었을 때만 옮긴다.** 재전송은 제출과 달리 요청이 도는 동안 사용자가
 * 코드 칸을 눌러 둘 수 있다 — 그 자리를 빼앗지 않는다. 막으려는 것은 `BODY` 낙하 하나다.
 *
 * **실패는 늘 옮긴다** — 제출 실패(`focusSubmitFailure`)와 같다. 그 표시는 포커스가 낭독 경로라
 * (`submitFailureAnnounce` 가 `focus` 를 준다) 옮기지 않으면 아무것도 읽히지 않는다.
 *
 * **언제 부를지는 호출부의 재전송 횟수 effect 가 정한다** — `submitCount` 와 같은 규칙이다.
 * 그 effect 는 재전송 버튼의 `loading` 이 풀린 렌더에서 돌아야 한다: 요청 중에는 `FormFailure`
 * 가 직전 실패를 걷어(`submitting`) 찾을 알림이 아직 없다.
 */
export function focusResendResult(
  container: HTMLElement | null | undefined,
  result: ResendResult,
  errors: FormErrors,
  errorStatus: number | null,
): boolean {
  if (container === null || container === undefined) return false
  if (result === 'sent' && !focusLost(container.ownerDocument)) return false
  return focusTargets(container, resendFocusTargets(result, errors, errorStatus), errors)
}

/** 비활성이 된 버튼이 `activeElement` 로 남는 브라우저도 잃은 것으로 본다 — 키 입력이 닿지 않는다 */
function focusLost(document: Document): boolean {
  const active = document.activeElement
  return active === null || active === document.body || active.matches(':disabled')
}

function focusTargets(
  container: HTMLElement,
  targets: readonly SubmitFailureFocusTarget[],
  errors: FormErrors,
): boolean {
  for (const target of targets) {
    const moved =
      target === 'field'
        ? focusFirstError(container, errors)
        : focusSelector(container, TARGET_SELECTOR[target])
    if (moved) return true
  }
  return false
}
