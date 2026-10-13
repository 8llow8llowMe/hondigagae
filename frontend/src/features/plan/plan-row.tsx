import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { PetAvatar } from '@/components/pet-avatar'
import { PlanStatusBadge } from '@/features/plan/plan-status-badge'
import { messages } from '@/lib/messages'
import { planCompanionLabel, type PlanCompanions } from '@/lib/plan/companion-pets'
import { formatPlanDateRange, tripPhaseOf } from '@/lib/plan/date'
import { needsCompletionPrompt } from '@/lib/plan/list'
import { planPhaseLabel, planPhaseNote } from '@/lib/plan/phase-text'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
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
  companions,
  today,
  periodEmphasized = false,
}: {
  plan: PlanSummaryItem
  /**
   * 동행 반려견, `petIds` 순서 (#218). **대표 한 마리가 아니다** — 두 마리 일정이
   * 한 마리로 보이면 일자 판정의 "함께 가는 아이 중" 과 어긋난다.
   *
   * **이름만이 아니라 `Pet` 이다** — 아바타가 사진을 그려야 한다. 이름만 받던 때에는 사진을
   * 올린 아이도 이 행에서만 이니셜로 떴다 (필터 레일은 같은 아이를 사진으로 그렸다).
   *
   * **무엇을 말할지는 `planCompanionsOf` 가 정한다** (#1042) — 반려견 조회가 실패했으면
   * `unknown` 이라 이 자리만 빠지고, 미완료 일정의 동행이 비었으면 "동행 반려견 없음",
   * 완료 일정의 지운 아이는 "삭제된 반려견" 으로 센다. **행을 숨기지 않는다** (공통명세 S8).
   */
  companions: PlanCompanions
  today: Date
  /**
   * 목록에 같은 제목이 또 있으면 켠다 (#1433, `duplicatedPlanTitles`). 날짜 줄을 캡션 회색에서
   * 본문 무게로 올려 제목 다음으로 읽히게 한다 — 기간이 곧 그 행의 이름이 된다.
   */
  periodEmphasized?: boolean
}) {
  /*
    목록은 출발 당일부터 `여행 중 · 오늘 1일차` 다 (#1433 · `tripPhaseOf`). 칸 나누기
    (`groupPlans`)도 같은 함수를 봐서 행과 칸 제목이 어긋나지 않는다
  */
  const phase = tripPhaseOf(plan.startDate, plan.endDate, today)
  const phaseLabel = planPhaseLabel(phase)
  const phaseNote = planPhaseNote(phase)
  // 아바타는 이름을 부를 아이가 있을 때만 선다 — "동행 반려견 없음" 옆의 원형은 없는 아이를 그린다
  const lead = companions.kind === 'listed' ? companions.pets[0] : undefined
  const companion = planCompanionLabel(companions)
  const completionPrompt = needsCompletionPrompt(plan, today)

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
            <span
              className={cn(
                'mt-1 block font-medium tabular-nums',
                periodEmphasized ? 'text-body-2 text-fg' : 'text-caption text-fg-muted',
              )}
            >
              {formatPlanDateRange(plan.startDate, plan.endDate)}
              {/* 여행 중일 때만 붙는다 — 기둥의 `여행 중` 이 며칠째인지까지는 못 말한다 */}
              {phaseNote !== null && ` · ${phaseNote}`}
            </span>
            {/*
              지난 확정 일정의 완료 안내 (#1433). 상태를 여기서 바꾸지 않는다 — 행 전체가 상세로
              가는 링크이고, 상세의 지난 일정에는 `여행 완료하기` 가 전폭 버튼으로 서 있다
              (`status-action.ts` `forwardActionPlacement`). 링크 안에 버튼을 또 두지 않는다
            */}
            {completionPrompt && (
              <span className="text-caption mt-1 flex flex-wrap items-center gap-x-1 font-medium">
                <span className="text-fg-muted">{messages.plan.completionPrompt}</span>
                <span className="text-brand-600 inline-flex items-center font-semibold">
                  {messages.plan.completionPromptAction}
                  <ChevronRightIcon size={16} />
                </span>
              </span>
            )}
          </span>

          <PlanStatusBadge status={plan.status} className="lg:hidden" />
        </span>

        {companion !== null && (
          <span className="hidden shrink-0 items-center gap-2 lg:flex">
            {/* 아바타는 대표 하나다 — 5마리까지 늘어나면 행의 폭이 터진다. 수는 글자가 말한다 */}
            {lead !== undefined && <PetAvatar url={lead.profileImageUrl} size="lg" />}
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
