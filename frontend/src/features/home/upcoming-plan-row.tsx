import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { planPhaseOf } from '@/lib/plan/date'
import { planPhaseLabel, planPhaseNote } from '@/lib/plan/phase-text'
import { INSET_CLASS } from '@/lib/ui/inset'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 다가오는 일정 — 아트보드 `01 홈 · P3` / `02 홈` 우측 하단.
 *
 * `D-16` 은 **오늘부터 출발일까지 남은 일수**다. 서버가 주지 않아 FE 가 계산한다.
 * **일정 상태(초안/확정)에 등급 색을 쓰지 않는다** — 상태는 판정이 아니라 진행 단계다.
 *
 * **여행 중인 일정도 여기 선다** (#561). `pickUpcomingPlans` 가 종료일 기준으로 고르므로
 * 오늘이 여행 기간 안이면 그 일정이 올라오는데, 예전에는 D-day 를 말할 수 없어 기둥이
 * 빈 채였다. 이제 같은 자리에 `여행 중` 이 서고 날짜 줄이 `오늘 4일차` 를 덧붙인다 —
 * 목록 행(`plan-row`)·상세 개요와 **같은 함수로** 만든 말이다.
 *
 * 데스크톱의 일자별 날씨 3칸은 `GET /plans/{planId}/weather` 가 필요해 이 화면 범위 밖이다.
 * 아트보드에는 있으나 지금은 그리지 않는다 — 없는 데이터를 지어내지 않는다.
 */
export function UpcomingPlanRow({ plan, today }: { plan: PlanSummaryItem; today: Date }) {
  const phase = planPhaseOf(plan.startDate, plan.endDate, today)
  const phaseLabel = planPhaseLabel(phase)
  const phaseNote = planPhaseNote(phase)

  /*
    **구분선과 좌우 여백을 스스로 정하지 않는다** (이슈 #439). 예전에는 `border-t` 와
    페이지 인셋 40 을 직접 걸었는데, 그 주석이 인용한 §0 은 **2a** 였다 — 카드가 없던
    때라 행 위 선이 유일한 경계였다. 3a 는 카드 테두리가 그 일을 하고, 항목 사이 선은
    `SurfaceList` 가 긋는다. 인셋도 카드 안 값(16/20)이다.
  */
  return (
    <li className={INSET_CLASS.card}>
      <Link
        href={`/plans/${plan.planId}`}
        className="focus-visible:ring-brand-500 flex items-center gap-3 pt-3 pb-5 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:gap-8 md:pt-5 md:pb-8"
      >
        <span className="min-w-0 flex-1">
          <span className="text-body-1 text-fg md:text-title-2 block font-semibold">
            {plan.title}
          </span>
          <span className="text-caption text-fg-muted mt-1 block font-medium tabular-nums">
            {plan.startDate} – {plan.endDate.slice(5)}
            <span className="md:hidden"> · {plan.status.name}</span>
            {/*
              데스크톱은 기둥의 말을 날짜 줄에도 되풀이한다(원래 ` · D-16`). 여행 중이면
              되풀이 대신 **며칠째인지**를 적는다 — 기둥이 이미 `여행 중` 이라고 말했다.

              **모바일 날짜 줄에는 넣지 않는다.** 그 자리는 상태명(`초안`/`확정`)이 쓰고
              있고, 좁은 폭에 셋을 세우면 줄이 넘친다. 목록 행은 상태명을 배지로 빼 두어
              자리가 남으므로 모바일에서도 `오늘 N일차` 를 붙인다 — 두 화면의 차이는
              날짜 줄에 무엇이 이미 서 있는지에서 온다.
            */}
            {phaseNote !== null ? (
              <span className="hidden md:inline"> · {phaseNote}</span>
            ) : (
              phaseLabel !== null && <span className="hidden md:inline"> · {phaseLabel}</span>
            )}
          </span>
        </span>

        {phaseLabel !== null && (
          <span className="text-body-2 md:text-body-1 shrink-0 font-bold whitespace-nowrap tabular-nums">
            {phaseLabel}
          </span>
        )}
        <ChevronRightIcon size={20} className="text-fg-subtle shrink-0 md:hidden" />
      </Link>
    </li>
  )
}
