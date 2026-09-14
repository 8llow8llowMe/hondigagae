/**
 * 예산 입력 판정. **일정 만들기와 이름·예산 수정이 같은 함수를 쓴다** — 두 폼이 같은 값에
 * 다른 답을 내면 어느 쪽이 맞는지 알 수 없다 (`lib/plan/date.ts` 와 같은 이유).
 */

/**
 * 예산 상한. **서버 제약의 복제본이다** (`form-guide.md §5`).
 *
 * `PlanCreateRequest.budget` 이 `Integer` 라 이 값을 넘으면 `@PositiveOrZero` 에 닿기도 전에
 * **Jackson 역직렬화 단계**에서 깨진다. 그 경로의 응답은 필드를 짚지 못해
 * `field: "request"` 에 `요청 본문을 읽을 수 없습니다. JSON 형식을 확인해 주세요.` 가 실린다 —
 * 개발자용 문구가 사용자에게 그대로 닿았다. dev 실측으로 `2147483647` 은 생성되고
 * `2147483648` 은 400 인 것을 확인했다.
 *
 * **제품 상한이 아니라 타입 상한이다.** 여행 예산으로 21억은 비현실적이지만 더 좁히면
 * *서버가 받아 주는 값을 화면이 거절한다*. 좁히려면 서버 `@Max` 를 함께 넣어야 한다.
 */
export const PLAN_BUDGET_MAX = 2_147_483_647

/** 예산 값의 문제. 빈 값은 "안 정했다" 라 문제가 아니다 */
export type PlanBudgetIssue = 'invalid' | 'too-large'

/**
 * 폼의 예산 문자열을 판정한다. 문제가 없으면 `null`.
 *
 * **`Number()` 로 먼저 바꾸지 않는다.** `Number('1e3')` 은 `1000`, `Number('+5')` 는 `5` 라
 * 서식 검사를 겸할 수 없다. 숫자만 받는지 정규식이 먼저 보고, 크기는 그다음이다
 * (`Number('')` 이 `0` 이라 조건 순서가 중요한 것과 같은 함정이다).
 */
export function planBudgetIssue(raw: string): PlanBudgetIssue | null {
  const value = raw.trim()
  if (value === '') return null
  if (!/^\d+$/.test(value)) return 'invalid'

  // 자릿수가 많으면 Number 가 정밀도를 잃지만, 상한 비교는 크기만 보므로 영향이 없다
  return Number(value) > PLAN_BUDGET_MAX ? 'too-large' : null
}
