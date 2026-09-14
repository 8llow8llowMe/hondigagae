import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { PetAvatar } from '@/components/pet-avatar'
import { PlanStatusBadge } from '@/features/plan/plan-status-badge'
import { companionLabel } from '@/lib/plan/companion-pets'
import { formatPlanDateRange, planPhaseOf } from '@/lib/plan/date'
import { planPhaseLabel, planPhaseNote } from '@/lib/plan/phase-text'
import { INSET_CLASS } from '@/lib/ui/inset'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 일정 행 — 아트보드 04(모바일) · 05(데스크톱).
 *
 * **썸네일이 없다.** 일정은 장소가 아니라 묶음이라 대표 이미지가 없고, 아트보드도
 * 그렇게 그렸다. D-day 와 상태 배지가 좌·우 기둥 역할을 한다.
 *
 * **`항목 6개 · 총 이동 96.3km` 를 쓰지 않는다.** `PlanSummaryItem` 에 그 필드가 없다.
 * 아트보드 05 주석 스스로도 "총 이동 거리 합계 같은 요약 통계는 넣지 않는다" 고 적었다
 * (공통명세 S2).
 *
 * 지역명(`제주시`)도 쓰지 않는다 — 목록은 `areaCode`(`'39'`) 만 준다.
 *
 * **L1 카드 안의 L2 항목이다** (#445). 자기 테두리를 두르지 않는다 — 구분선은 `SurfaceList` 가
 * 항목 사이에만 긋고, 그래서 `last` 가 없다(#439). 인셋은 카드 안 값(16/20)이다.
 */
export function PlanRow({
  plan,
  petNames,
  today,
}: {
  plan: PlanSummaryItem
  /**
   * 동행 반려견 이름, `petIds` 순서 (#218). **대표 한 마리가 아니다** — 두 마리 일정이
   * 한 마리로 보이면 일자 판정의 "함께 가는 아이 중" 과 어긋난다.
   *
   * 조회가 실패했거나 전부 삭제됐으면 빈 배열이다. **행을 숨기지 않는다** (공통명세 S8).
   */
  petNames: readonly string[]
  today: Date
}) {
  const phase = planPhaseOf(plan.startDate, plan.endDate, today)
  const phaseLabel = planPhaseLabel(phase)
  const phaseNote = planPhaseNote(phase)
  const companion = companionLabel(petNames)

  return (
    <li className={INSET_CLASS.card}>
      <Link
        href={`/plans/${plan.planId}`}
        className="focus-visible:ring-brand-500 flex flex-col gap-2 py-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none lg:flex-row lg:items-center lg:gap-5 lg:py-5"
      >
        {/* min-w-0 이 함께 있어야 한다 — flex 항목의 기본 min-width:auto 는 min-content
            아래로 못 내려가고, 한국어 keep-all 이라 긴 제목 전체가 하나의 덩어리다 */}
        <span className="flex min-w-0 flex-1 items-start justify-between gap-2 lg:block">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-title-2 text-fg font-semibold break-keep">{plan.title}</span>
              {/* 데스크톱은 제목 옆, 모바일은 행 우측 상단 — 위치만 다르고 같은 배지다 */}
              <PlanStatusBadge status={plan.status} className="hidden lg:inline-flex" />
            </span>
            <span className="text-caption text-fg-muted mt-1 block font-medium tabular-nums">
              {formatPlanDateRange(plan.startDate, plan.endDate)}
              {/* 여행 중일 때만 붙는다 — 기둥의 `여행 중` 이 며칠째인지까지는 못 말한다 */}
              {phaseNote !== null && ` · ${phaseNote}`}
            </span>
          </span>

          <PlanStatusBadge status={plan.status} className="lg:hidden" />
        </span>

        {companion !== null && (
          <span className="hidden shrink-0 items-center gap-2 lg:flex">
            {/* 아바타는 대표 하나다 — 5마리까지 늘어나면 행의 폭이 터진다. 수는 글자가 말한다 */}
            <PetAvatar name={petNames[0] ?? ''} size="lg" />
            <span className="text-body-2 text-fg-muted font-medium">{companion}</span>
          </span>
        )}

        {phaseLabel !== null && (
          <span className="text-body-2 text-fg self-end font-bold whitespace-nowrap tabular-nums lg:w-14 lg:self-auto lg:text-right">
            {phaseLabel}
          </span>
        )}

        <ChevronRightIcon size={20} className="text-fg-subtle hidden shrink-0 lg:block" />
      </Link>
    </li>
  )
}
