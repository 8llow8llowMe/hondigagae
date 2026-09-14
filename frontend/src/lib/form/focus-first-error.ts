import type { FormErrors } from '@/lib/form/field-errors'

/**
 * 선택자에 그대로 끼워 넣어도 안전한 필드명. 영문/숫자/`_`로 시작하고 `.` `-` 까지 허용한다.
 *
 * **필드명이 전부 우리가 지은 이름인 것은 아니다.** 서버 검증 오류의 키는 백엔드
 * `fieldErrors[].field` 가 그대로 들어오므로(`field-errors.ts`), 따옴표나 역슬래시가
 * 섞인 값이 오면 `[id="…"]` 가 깨져 `querySelector` 가 `SyntaxError` 를 던진다.
 * 포커스를 못 옮기는 것은 불편이지만 예외가 튀면 화면이 죽는다 — 거른다.
 */
const SAFE_FIELD_NAME = /^[A-Za-z_][\w.-]*$/

/**
 * 오류가 붙은 필드 전부를 한 선택자로 묶는다. 매칭이 없으면 `null`.
 *
 * **`querySelector` 가 선택자 그룹에서 돌려주는 것은 "선택자 순서상 첫 매칭" 이 아니라
 * "문서 순서상 첫 매칭" 이다.** 그래서 이 한 줄이 곧 "화면에서 첫 번째로 보이는 오류" 다.
 *
 * 순수 함수라 node 에서 테스트된다 (`testing-guide.md` §1).
 */
export function errorFieldSelector(errors: FormErrors): string | null {
  const selector = Object.keys(errors.fields)
    .filter((field) => SAFE_FIELD_NAME.test(field))
    /*
      `[name]` 을 함께 보는 것은 필드명이 `id` 에 없는 컨트롤을 위해서다. `RadioGroup` 이
      `<fieldset>` 에 `id` 를 달지 않던 동안 `#petId` 에 해당하는 요소가 없었던 것이
      시작이고, 지금도 필드명이 `name` 에만 있는 컨트롤이 생기면 이 한 줄이 계속 맞는다.
    */
    .flatMap((field) => [`[id="${field}"]`, `[name="${field}"]`])
    .join(', ')

  return selector === '' ? null : selector
}

/** 필드 단위 오류가 하나라도 있는가. `form` 오류(필드로 좁혀지지 않는 것)는 세지 않는다 */
export function hasFieldErrors(errors: FormErrors): boolean {
  return Object.keys(errors.fields).length > 0
}

/**
 * 오류가 붙은 필드 중 **화면에서 첫 번째로 보이는 것**으로 포커스를 옮긴다.
 * 옮겼으면 `true`, 대상을 못 찾았으면 `false`.
 *
 * ## 왜 "첫 오류" 를 여기서 고르나
 *
 * 예전에는 `useForm` 이 `Object.keys(errors.fields)[0]` 로 골라 `firstErrorField` 하나를
 * 내려보냈다. 그 순서는 **zod 스키마의 키 선언 순서**이지 화면 순서가 아니다. `/plans/new`
 * 는 화면이 `시작일 → 종료일 → 반려견 → 제목 → 예산` 인데 `planFormSchema` 는
 * `petId → title → startDate → …` 라, 빈 채로 제출하면 위의 두 오류를 지나쳐 **제목**에
 * 포커스가 갔다 (#560 실측).
 *
 * `/ai-plans/new` 와 `/pets/new` 가 그동안 맞았던 것은 **두 순서가 우연히 같아서**다.
 * 즉 스키마를 재배치하는 순간 조용히 깨지는 구조였다. 한 폼을 땜질하는 대신 고르는
 * 방식을 DOM 순서로 바꿔, 어느 폼이든 "보이는 첫 오류" 가 답이 되게 한다.
 *
 * ## 트리거는 여전히 `submitCount` 다
 *
 * 이 함수는 **무엇을** 고를지만 정한다. **언제** 부를지는 호출부의 effect 가 정하고, 그
 * 트리거는 `submitCount` 하나여야 한다 — `errors` 를 의존성에 넣으면 입력 중인 필드에서
 * 포커스를 훔친다 (`use-form.ts` 의 `submitCount` JSDoc). effect 안에서 `errors` 를
 * **읽는 것**은 안전하다: 오류와 `submitCount` 는 같은 제출에서 함께 바뀌므로 클로저가
 * 잡는 값이 그 제출의 오류다.
 */
export function focusFirstError(
  container: HTMLElement | null | undefined,
  errors: FormErrors,
): boolean {
  if (container === null || container === undefined) return false

  const selector = errorFieldSelector(errors)
  if (selector === null) return false

  const target = container.querySelector<HTMLElement>(selector)
  if (target === null) return false

  target.focus()
  return true
}
