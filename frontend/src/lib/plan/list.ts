import { isPastPlan } from '@/lib/plan/date'
import type { PlanFilters, PlanStatusFilter, PlanSummaryItem } from '@/types/plan'

/**
 * 목록 좁히기 · 나누기 · 세기.
 *
 * `GET /plans` 에는 **`status`·`petId` 파라미터가 없고 `totalCount` 도 없다.**
 * 좁히기는 전부 여기서 한다 (공통명세 S3).
 */

export function filterPlans(
  plans: readonly PlanSummaryItem[],
  filters: PlanFilters,
): PlanSummaryItem[] {
  return plans.filter(
    (plan) =>
      (filters.status === 'ALL' || plan.status.code === filters.status) &&
      (filters.petIds.length === 0 || filters.petIds.includes(plan.petId)),
  )
}

export function hasActiveFilters(filters: PlanFilters): boolean {
  return filters.status !== 'ALL' || filters.petIds.length > 0
}

export type PlanGroups = {
  upcoming: PlanSummaryItem[]
  past: PlanSummaryItem[]
}

/**
 * 다가오는 / 지난으로 나눈다. **날짜 기준이고 상태 기준이 아니다** (공통명세 S4) —
 * `COMPLETED` 로 가는 경로가 서버에 없어 상태로 나누면 지난 일정이 영원히 빈다.
 *
 * 서버 정렬은 `id DESC`(만든 순서)라 여행 목록에서 의미가 없어 재정렬한다.
 * 다가오는 것은 가까운 여행이 위로, 지난 것은 최근 여행이 위로 온다.
 */
export function groupPlans(plans: readonly PlanSummaryItem[], today: Date): PlanGroups {
  const upcoming: PlanSummaryItem[] = []
  const past: PlanSummaryItem[] = []

  for (const plan of plans) {
    if (isPastPlan(plan.endDate, today)) past.push(plan)
    else upcoming.push(plan)
  }

  // 같은 날 출발하는 일정이 여러 개면 planId 로 순서를 고정한다 —
  // 비교 함수가 0 을 돌려주면 브라우저마다 순서가 갈릴 수 있다
  upcoming.sort((a, b) => compare(a.startDate, b.startDate) || compare(a.planId, b.planId))
  past.sort((a, b) => compare(b.endDate, a.endDate) || compare(b.planId, a.planId))

  return { upcoming, past }
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * 상태별 개수. **전량을 받았을 때만 화면에 쓴다** — `hasNext` 인 동안은 아직 안 받아
 * 온 것을 0 이라고 말하게 된다 (공통명세 S3).
 *
 * 반려견 필터를 적용한 뒤 값이다 (아트보드 04 주석: "몽실이 선택 시 확정 0").
 * **0 을 감추지 않는다.**
 */
export function countByStatus(plans: readonly PlanSummaryItem[]): Record<PlanStatusFilter, number> {
  const counts: Record<PlanStatusFilter, number> = {
    ALL: plans.length,
    DRAFT: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
  }

  for (const plan of plans) {
    const code = plan.status.code
    // 서버가 모르는 코드를 내려도 ALL 에는 이미 세어져 있다 — 여기서 버려도 합이 맞는다
    if (code === 'DRAFT' || code === 'CONFIRMED' || code === 'COMPLETED') counts[code] += 1
  }

  return counts
}

/** 반려견별 개수. 상태 필터를 적용한 뒤 값이다 — 두 축이 서로를 기준으로 센다 */
export function countByPet(plans: readonly PlanSummaryItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const plan of plans) counts.set(plan.petId, (counts.get(plan.petId) ?? 0) + 1)
  return counts
}
