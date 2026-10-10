import { messages } from '@/lib/messages'
import type { PlanPhase } from '@/lib/plan/date'

/**
 * `PlanPhase` 를 화면 문구로 옮긴다.
 *
 * **판정(`planPhaseOf`)과 표기를 갈라 둔다** — 판정은 날짜만 알면 되고 문구를 모른다.
 * 그런데 D-day 기둥을 그리는 화면이 셋(홈 행 · 목록 행 · 상세 개요)이라, 문구를 각자
 * 만들면 같은 일정에 다른 말을 하게 된다. 그래서 **문구도 한 군데에서만 만든다**
 * (`lib/plan/date.ts` 머리주석의 원칙을 표기 쪽으로 이은 것이다).
 */

/**
 * D-day 기둥에 설 말 — `D-11` · `D-DAY` · `여행 중`.
 *
 * **지난 일정과 날짜를 못 읽은 일정은 `null` 이다.** 자리를 비우는 것이 예전 동작이고,
 * 지난 일정에 `D+3` 같은 말을 새로 지어내지 않는다.
 */
export function planPhaseLabel(phase: PlanPhase | null): string | null {
  if (phase === null || phase.kind === 'past') return null
  if (phase.kind === 'ongoing') return messages.plan.ongoing

  return phase.days === 0
    ? messages.plan.ddayToday
    : messages.plan.dday.replace('{days}', String(phase.days))
}

/**
 * 날짜 줄에 덧붙는 진행도 — `오늘 4일차`. **여행 중일 때만 있다.**
 *
 * 배지(`planPhaseLabel`)는 `여행 중` 이라고만 말하고 며칠째인지는 말하지 않는다.
 * 기둥 자리가 좁아 `여행 중 4일차` 가 들어가지 않고, 날짜 줄에는 이미 기간이 적혀 있어
 * 그 옆이 제일 읽기 좋다.
 */
export function planPhaseNote(phase: PlanPhase | null): string | null {
  return phase?.kind === 'ongoing'
    ? messages.plan.ongoingDay.replace('{day}', String(phase.day))
    : null
}
