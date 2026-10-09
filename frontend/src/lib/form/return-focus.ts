import type { FormErrors } from '@/lib/form/field-errors'
import { errorFieldSelector } from '@/lib/form/focus-first-error'

/** 폼 안의 **살아 있는** 제출 버튼. 비활성 버튼은 `focus()` 를 받지 못해 `BODY` 로 떨어진다 */
export const FORM_SUBMIT_SELECTOR = 'form button[type="submit"]:not([disabled])'

/**
 * 폼 위에 띄운 오버레이를 닫을 때 **포커스가 돌아갈 자리**의 후보 순서 (#1295).
 *
 * 1. 화면의 첫 오류 칸 — 고칠 자리다 (`focusSubmitFailure` 의 첫 대상과 같은 판단)
 * 2. 제출 버튼 — 오버레이가 막아 선 동작을 다시 낼 자리다
 *
 * ## 왜 "열기 직전의 활성 요소" 로는 안 되나
 *
 * `useOverlay` 는 `triggerRef` 가 없으면 열 때의 `document.activeElement` 로 돌아간다. 그런데 **제출
 * 응답이 오버레이를 연 경우**(가입 3단계에서 서버가 동의를 거부해 약관 시트를 다시 띄움) 그 순간의
 * 활성 요소는 `BODY` 다 — 제출 중 `가입하기` 가 `disabled` 라 포커스를 잃었다. 닫으면 `BODY` 로 돌아가
 * 키보드 사용자가 문서 맨 위에서 다시 시작했다.
 */
export function returnFocusSelectors(errors: FormErrors): string[] {
  const field = errorFieldSelector(errors)
  return field === null ? [FORM_SUBMIT_SELECTOR] : [field, FORM_SUBMIT_SELECTOR]
}

/**
 * `returnFocusSelectors` 순서대로 컨테이너 안에서 처음 찾힌 요소. 없으면 `null` — 호출부는 이 값을
 * `useOverlay` 의 `triggerRef` 에 담고, `null` 이면 오버레이가 예전대로 열기 직전 요소로 돌아간다.
 *
 * **고르기만 하고 포커스는 옮기지 않는다.** 옮기는 것은 `useOverlay` 의 닫기 cleanup 하나다 —
 * 두 곳이 옮기면 순서에 따라 결과가 갈린다.
 *
 * 컨테이너를 `querySelector` 하나로 받는 것은 node 테스트에서 가짜로 갈아 끼우기 위해서다
 * (testing-guide.md §1 — jsdom 이 없다).
 */
export function returnFocusTarget<T>(
  container: { querySelector: (selector: string) => T | null } | null | undefined,
  errors: FormErrors,
): T | null {
  if (container === null || container === undefined) return null
  for (const selector of returnFocusSelectors(errors)) {
    const target = container.querySelector(selector)
    if (target !== null) return target
  }
  return null
}
