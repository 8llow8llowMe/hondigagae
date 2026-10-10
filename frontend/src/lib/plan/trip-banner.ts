import { parseDay } from '@/lib/date/day'
import { pickBriefingDate } from '@/lib/plan/briefing'
import { planPhaseOf } from '@/lib/plan/date'
import { pickUpcomingPlans } from '@/lib/plan/upcoming'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 홈 첫 화면 여행 배너가 설 수 있는 가장 먼 날 — 출발 7일 전 (#1113).
 *
 * 그보다 멀면 홈 맨 아래 `다가오는 일정` 한 줄로 충분하다. 배너는 "곧 · 지금" 의 일이라
 * 상시로 세우면 `tone="brand"` 가 말하는 "시간이 정한 진입점" 이 흐려진다 (DESIGN.md §0-3).
 */
export const TRIP_BANNER_DAYS = 7

/**
 * 배너 갈래 셋.
 *
 * - `TODAY` — 출발 당일 ~ 마지막 날. 오늘의 브리핑으로 보낸다. `day` 는 오늘이 며칠째인가
 * - `EVE` — 출발 하루 전. 내일 출발 브리핑으로 보낸다
 * - `SOON` — 출발 2 ~ 7일 전. 브리핑은 아직 열리지 않아(기간 밖) 일정 상세로 보낸다
 */
export type TripBanner =
  | { kind: 'TODAY'; plan: PlanSummaryItem; day: number }
  | { kind: 'EVE'; plan: PlanSummaryItem }
  | { kind: 'SOON'; plan: PlanSummaryItem; days: number }

/**
 * 홈 첫 화면 여행 배너가 세울 일정 하나 (#1113 · 홈 명세 D5-1c).
 *
 * **새 판정을 만들지 않는다.** 고르는 것은 `pickUpcomingPlans` (지난 일정 제외 · 출발일 순),
 * 브리핑 갈래는 `pickBriefingDate`(일정 상세 배너와 같은 규칙), 남은 일수는 `planPhaseOf` 다 —
 * 같은 일정을 홈 배너와 상세 배너가 다른 날로 부르지 않게 한다.
 *
 * **가장 가까운 한 건만 본다.** 정렬이 출발일 순이라 여행 중인 일정이 있으면 그것이 먼저다.
 * 가장 가까운 일정이 7일 밖이면 나머지도 다 밖이다.
 *
 * **기간이 성립하지 않는 일정은 후보에서 먼저 뺀다** — 날짜를 못 읽거나 종료일이 시작일보다
 * 앞선 것. `pickBriefingDate` 는 그런 일정을 거절하는데 `planPhaseOf` 는 시작일만 보고 `upcoming`
 * 을 줘, 상세가 "기간이 성립하지 않는다" 고 보는 일정을 홈이 `D-5` 라고 부를 수 있었다. 또
 * `pickUpcomingPlans` 는 문자열로 정렬해 깨진 시작일(`''`)이 맨 앞에 오므로, 빼지 않으면 그 한
 * 건이 7일 안쪽의 정상 일정을 가린다.
 *
 * **상태(`status.code`)를 보지 않는다** — 브리핑 진입 배너와 같은 이유다(여행브리핑 D8-5).
 * `COMPLETED` 로 가는 자동 전이가 없어 상태가 날짜를 못 따라간다.
 *
 * @param today `dayToLocalNoon(todayIso)` — `planPhaseOf` · `pickUpcomingPlans` 가 받는 모양
 * @param todayIso 서버가 정한 `YYYY-MM-DD` — `pickBriefingDate` 가 받는 모양
 */
export function pickTripBanner(
  plans: PlanSummaryItem[],
  today: Date,
  todayIso: string,
): TripBanner | null {
  const [plan] = pickUpcomingPlans(plans.filter(hasValidPeriod), today, 1)
  if (plan === undefined) return null

  const phase = planPhaseOf(plan.startDate, plan.endDate, today)
  const briefing = pickBriefingDate(plan.startDate, plan.endDate, todayIso)

  // 출발 당일은 `planPhaseOf` 가 `upcoming`(D-DAY)에 남긴다 — 그날이 1일차다
  if (briefing?.kind === 'TODAY') {
    return { kind: 'TODAY', plan, day: phase?.kind === 'ongoing' ? phase.day : 1 }
  }

  if (briefing?.kind === 'EVE') return { kind: 'EVE', plan }

  if (phase?.kind === 'upcoming' && phase.days >= 2 && phase.days <= TRIP_BANNER_DAYS) {
    return { kind: 'SOON', plan, days: phase.days }
  }

  return null
}

function hasValidPeriod(plan: PlanSummaryItem): boolean {
  return (
    parseDay(plan.startDate) !== null &&
    parseDay(plan.endDate) !== null &&
    plan.startDate <= plan.endDate
  )
}

/**
 * 홈이 세울 일정 둘 — 첫 화면 배너와 맨 아래 `다가오는 일정` (#1113 · 명세 D5-1c).
 *
 * **배너에 선 일정은 아래 목록에서 뺀다.** 같은 목적지가 한 화면에 두 번 서지 않게 한다.
 * `sectionShown` 이 `false` 면 섹션째 숨긴다 — 배너가 유일한 다가오는 일정을 가져간 날에
 * `다가오는 일정이 없어요` 를 그리면 바로 위 배너와 정면으로 어긋난다. 배너가 없는 날의 빈
 * 상태(일정 없음 · 전부 지남)는 그대로 섹션이 말한다.
 *
 * 게스트 판정(`authed`)은 부르는 쪽이 갖는다 — 여기서는 받은 목록만 본다.
 */
export function pickHomePlans(
  plans: PlanSummaryItem[],
  today: Date,
  todayIso: string,
  count: number,
): { banner: TripBanner | null; upcoming: PlanSummaryItem[]; sectionShown: boolean } {
  const banner = pickTripBanner(plans, today, todayIso)
  const upcoming = pickUpcomingPlans(
    plans.filter((plan) => plan.planId !== banner?.plan.planId),
    today,
    count,
  )

  return { banner, upcoming, sectionShown: !(banner !== null && upcoming.length === 0) }
}
