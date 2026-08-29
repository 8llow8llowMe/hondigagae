import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { daysUntil } from '@/lib/plan/date'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 다가오는 일정 — 아트보드 `01 홈 · P3` / `02 홈` 우측 하단.
 *
 * `D-16` 은 **오늘부터 출발일까지 남은 일수**다. 서버가 주지 않아 FE 가 계산한다.
 * **일정 상태(초안/확정)에 등급 색을 쓰지 않는다** — 상태는 판정이 아니라 진행 단계다.
 *
 * 데스크톱의 일자별 날씨 3칸은 `GET /plans/{planId}/weather` 가 필요해 이 화면 범위 밖이다.
 * 아트보드에는 있으나 지금은 그리지 않는다 — 없는 데이터를 지어내지 않는다.
 */
export function UpcomingPlanRow({ plan, today }: { plan: PlanSummaryItem; today: Date }) {
  const dday = daysUntil(plan.startDate, today)

  return (
    <Link
      href={`/plans/${plan.planId}`}
      className="focus-visible:ring-brand-500 flex items-center gap-3 px-4 pt-2 pb-5 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:gap-8 md:px-10 md:pt-4 md:pb-8"
    >
      <span className="min-w-0 flex-1">
        <span className="text-body-1 text-fg md:text-title-2 block font-semibold">
          {plan.title}
        </span>
        <span className="text-caption text-fg-muted mt-0.5 block font-medium tabular-nums">
          {plan.startDate} – {plan.endDate.slice(5)}
          <span className="md:hidden"> · {plan.status.name}</span>
          {dday !== null && <span className="hidden md:inline"> · D-{dday}</span>}
        </span>
      </span>

      {dday !== null && (
        <span className="text-body-2 md:text-body-1 shrink-0 font-bold tabular-nums">D-{dday}</span>
      )}
      <ChevronRightIcon size={20} className="text-fg-subtle shrink-0 md:hidden" />
    </Link>
  )
}
