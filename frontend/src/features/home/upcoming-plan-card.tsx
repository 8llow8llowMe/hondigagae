import Link from 'next/link'

import { Badge } from '@/components/badge'
import { Row } from '@/components/surface'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 다가오는 일정 — 홈-세부명세 D2.
 *
 * **일정 상태(초안/확정/완료)에 등급 색을 쓰지 않는다** (DESIGN.md §2-3).
 * 상태는 판정이 아니라 진행 단계다 — 중립 태그로 둔다.
 *
 * 날짜에 `tabular-nums` 를 건다. 목록에서 자릿수가 흔들리면 값을 비교할 수 없다.
 */
export function UpcomingPlanCard({ plan, last = true }: { plan: PlanSummaryItem; last?: boolean }) {
  return (
    <Row as="li" last={last}>
      <Link
        href={`/plans/${plan.planId}`}
        className="focus-visible:ring-brand-500 flex flex-col gap-2 py-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-title-2 text-fg min-w-0 font-semibold break-words">{plan.title}</h3>
          <div className="shrink-0">
            <Badge tone="neutral" size="sm">
              {plan.status.name}
            </Badge>
          </div>
        </div>
        <p className="text-body-2 text-fg-muted tabular-nums">
          {plan.startDate} – {plan.endDate}
        </p>
      </Link>
    </Row>
  )
}
