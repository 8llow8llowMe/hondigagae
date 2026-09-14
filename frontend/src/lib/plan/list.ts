import { planPhaseOf } from '@/lib/plan/date'
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
      /*
        **한 마리라도 동행이면 히트다** (#152). 대표(`petId`) 하나만 보면 두 마리로 만든
        일정이 둘째 반려견으로 거를 때 사라진다 — 백엔드도 `GET /plans?petId=` 를
        대표 컬럼과 조인 테이블을 **둘 다** 보도록 바꿨다 (설계 판단 3).
      */
      (filters.petIds.length === 0 || plan.petIds.some((petId) => filters.petIds.includes(petId))),
  )
}

export function hasActiveFilters(filters: PlanFilters): boolean {
  return filters.status !== 'ALL' || filters.petIds.length > 0
}

export type PlanGroups = {
  ongoing: PlanSummaryItem[]
  upcoming: PlanSummaryItem[]
  past: PlanSummaryItem[]
}

/**
 * 여행 중 / 다가오는 / 지난으로 나눈다. **날짜 기준이고 상태 기준이 아니다** (공통명세 S4) —
 * `COMPLETED` 로 가는 경로가 서버에 없어 상태로 나누면 지난 일정이 영원히 빈다.
 *
 * **`여행 중` 이 셋째 칸이다** (#561). 전에는 "지난 게 아니면 전부 다가오는" 이라 오늘
 * 여행 중인 일정이 `다가오는 일정` 제목 아래 D-day 도 없이 섰다. 판정은 이 파일이 하지
 * 않고 `planPhaseOf` 하나에 맡긴다 — 목록·홈·상세가 같은 답을 말해야 한다.
 *
 * 서버 정렬은 `id DESC`(만든 순서)라 여행 목록에서 의미가 없어 재정렬한다.
 * 여행 중·다가오는 것은 가까운 여행이 위로, 지난 것은 최근 여행이 위로 온다.
 */
export function groupPlans(plans: readonly PlanSummaryItem[], today: Date): PlanGroups {
  const ongoing: PlanSummaryItem[] = []
  const upcoming: PlanSummaryItem[] = []
  const past: PlanSummaryItem[] = []

  for (const plan of plans) {
    const phase = planPhaseOf(plan.startDate, plan.endDate, today)
    // 날짜를 못 읽으면(`null`) 다가오는 쪽이다 — 지난 쪽으로 미는 편이 더 위험하다
    if (phase?.kind === 'past') past.push(plan)
    else if (phase?.kind === 'ongoing') ongoing.push(plan)
    else upcoming.push(plan)
  }

  // 같은 날 출발하는 일정이 여러 개면 planId 로 순서를 고정한다 —
  // 비교 함수가 0 을 돌려주면 브라우저마다 순서가 갈릴 수 있다
  ongoing.sort((a, b) => compare(a.startDate, b.startDate) || compare(a.planId, b.planId))
  upcoming.sort((a, b) => compare(a.startDate, b.startDate) || compare(a.planId, b.planId))
  past.sort((a, b) => compare(b.endDate, a.endDate) || compare(b.planId, a.planId))

  return { ongoing, upcoming, past }
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

/**
 * 반려견별 개수. 상태 필터를 적용한 뒤 값이다 — 두 축이 서로를 기준으로 센다.
 *
 * **동행 일정은 아이마다 한 번씩 센다** (#152). 그래서 합이 `plans.length` 를 넘을 수
 * 있는데, 그게 맞다 — `filterPlans` 가 "한 마리라도 동행이면 히트" 이므로 대표만 세면
 * "초코 0건" 이라고 적어 놓고 골랐을 때 일정이 나오는 모순이 생긴다.
 */
export function countByPet(plans: readonly PlanSummaryItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const plan of plans) {
    for (const petId of plan.petIds) counts.set(petId, (counts.get(petId) ?? 0) + 1)
  }
  return counts
}
