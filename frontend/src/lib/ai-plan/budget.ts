/**
 * 예산 어림값 칩 — 아트보드 01 (`20만원` · `30만원` · `50만원` + `상관없음`).
 *
 * **단위는 만원이다.** 계약(`AiPlanCreateRequest.budget`)은 원 단위이고 변환은
 * `src/lib/ai-plan/submit.ts` 가 한다.
 */
export const BUDGET_PRESETS_MANWON = [20, 30, 50] as const

/** 원 단위 예산을 사람이 읽는 표기로. `null` 이면 예산을 정하지 않았다 */
export function formatBudget(won: number | null): string | null {
  if (won === null) return null

  // 만원 단위로 딱 나뉘면 만원으로 쓴다 — 폼이 만원 단위로 받으므로 대부분 그렇다
  if (won % 10_000 === 0) return `${(won / 10_000).toLocaleString('ko-KR')}만원`

  return `${won.toLocaleString('ko-KR')}원`
}
