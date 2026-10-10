import type { PlanPhase } from '@/lib/plan/date'

/**
 * 오늘 항목을 **다녀옴으로 새로 표시**할 수 있는가 (#983).
 *
 * **서버 가드 `PLAN_027` 과 같은 선이다.** 백엔드는 서비스 기준 오늘(KST)이 시작일보다 앞이면
 * `visited: true` 를 400 으로 거절하고, 시작일 당일부터 받는다. 일정 상태는 보지 않고 날짜만
 * 본다. **해제(`visited: false`)는 언제나 받는다** — 가드 이전에 찍힌 표시나 기간을 미래로 옮긴
 * 뒤 남은 표시를 풀 수 있어야 한다. 그래서 이 판정은 "표시" 한 방향만 말한다.
 *
 * `여행 완료하기`(#971 · `PLAN_026` · `status-action.ts` 의 `forwardActionPlacement`)와 같은
 * 모양이다 — 서버가 거절할 일을 보여 주고 눌러서 배우게 하지 않는다.
 *
 * **판정 축은 `planPhaseOf` 하나다.** 같은 화면의 D-day 배지·상태 버튼·출발 전 접기(#732)가
 * 전부 그 `PlanPhase` 에서 나온다. 출발 당일은 `upcoming · days 0` 이라 `days >= 1` 이 거절선이다.
 *
 * **날짜를 못 읽으면(`null`) 표시할 수 있다고 본다** — 있던 진입점을 근거 없이 감추지 않는다.
 * 최종 판정은 서버가 한다.
 */
export function canMarkVisited(phase: PlanPhase | null): boolean {
  return !(phase?.kind === 'upcoming' && phase.days >= 1)
}

/**
 * 항목 행의 다녀옴 토글 모양 (#124 · #732 · #983).
 *
 * - `hidden` — 토글을 두지 않는다. 표시할 수 없는 날(D-1 이전)의 **미체크** 항목이다.
 * - `icon` — 체크 아이콘만. 출발 전(`compact`) 미체크 항목이다 — `다녀옴 표시` 반복을 접는다(#732).
 * - `label` — 글자가 붙은 토글. 체크된 항목은 언제나 이것이다 — `다녀옴` 은 상태를 말하는
 *   유일한 낱말이고(DESIGN.md §7), 해제는 날짜와 무관하게 서버가 받는다.
 *
 * #983 이후 `icon` 이 실제로 서는 날은 출발 당일(D-DAY)뿐이다 — 그 전날까지 미체크 항목은
 * `hidden` 이다. `compact` 와 `canMark` 를 한 값으로 합치지 않은 것은 두 판정의 근거가 달라서다
 * (반복 줄이기 vs 서버 가드).
 */
export type VisitToggleForm = 'hidden' | 'icon' | 'label'

export function visitToggleForm(
  visited: boolean,
  visit: { compact: boolean; canMark: boolean },
): VisitToggleForm {
  if (visited) return 'label'
  if (!visit.canMark) return 'hidden'
  return visit.compact ? 'icon' : 'label'
}
