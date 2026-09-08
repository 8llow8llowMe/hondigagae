'use client'

import { CheckIcon } from '@/components/icons'
import { PlanStatusBadge } from '@/features/plan/plan-status-badge'
import { messages } from '@/lib/messages'
import { formatPlanDateRange } from '@/lib/plan/date'
import { cn } from '@/lib/utils/cn'
import type { PlanSummaryItem } from '@/types/plan'

/** 일자 버튼 하나가 아는 것 — 날짜와 그날 항목 수 */
export type AddToPlanDayOption = {
  /** 1부터 */
  day: number
  /** `YYYY-MM-DD`. 기간을 못 읽으면 null — 그때는 일차만 쓴다 */
  date: string | null
  itemCount: number
  /** 이 장소가 그 일자에 이미 담겨 있다 */
  already: boolean
}

/**
 * 담기 시트 1단계 — **일정과 일자를 한 화면에서 고른다** (아트보드 02-A).
 *
 * **두 단계로 나누지 않는다.** 아트보드가 이유를 적었다: 화면을 나누면 "어느 날인지" 를
 * 놓친 채 담게 된다. 일정을 고르면 그 아래에 일자 버튼이 채워지는 형태다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 *
 * **아트보드의 `항목 6개` 를 일정 행에 쓰지 않는다.** `PlanSummaryItem` 에 항목 수가 없고,
 * 목록 행(`plan-row.tsx`)이 같은 이유로 이미 그것을 뺐다 — 여기서만 되살리면 없는 값을
 * 지어내야 한다. **일자 버튼의 항목 수는 그대로 쓴다** — 그쪽은 상세를 받아서 안다.
 */
export function PlaceAddToPlanPicker({
  plans,
  selectedPlanId,
  onSelectPlan,
  days,
  daysLoading,
  selectedDay,
  onSelectDay,
}: {
  plans: PlanSummaryItem[]
  selectedPlanId: string | null
  onSelectPlan: (planId: string) => void
  /** 고른 일정의 일자들. 아직 안 골랐거나 조회 중이면 빈 배열 */
  days: AddToPlanDayOption[]
  daysLoading: boolean
  selectedDay: number | null
  onSelectDay: (day: number) => void
}) {
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {plans.map((plan) => {
          const selected = plan.planId === selectedPlanId

          return (
            <li key={plan.planId} className="border-border border-b last:border-b-0">
              <button
                type="button"
                onClick={() => onSelectPlan(plan.planId)}
                aria-pressed={selected}
                className={cn(
                  'focus-visible:ring-brand-500 flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none',
                  selected && 'bg-band',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-body-1 text-fg font-semibold break-keep">
                      {plan.title}
                    </span>
                    <PlanStatusBadge status={plan.status} />
                  </span>
                  <span className="text-caption text-fg-muted mt-1 block font-medium tabular-nums">
                    {formatPlanDateRange(plan.startDate, plan.endDate)}
                  </span>
                </span>

                {/* 고른 것을 체크로 말한다 — 배경 tint 만으로는 대비가 약하다 */}
                {selected && <CheckIcon size={20} strokeWidth={2} className="text-brand-700" />}
              </button>

              {/*
                **고른 일정 바로 아래에 일자를 편다.** 시트 맨 밑에 두면 목록이 길 때
                고른 일정과 일자가 한 화면에 함께 보이지 않는다.
              */}
              {selected && (
                <div className="px-4 pt-1 pb-4">
                  <h3 className="text-caption text-fg-muted mb-2 font-semibold">
                    {messages.plan.addToPlanDayTitle}
                  </h3>

                  {daysLoading ? (
                    <p className="text-caption text-fg-muted">{messages.common.loading}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {days.map((option) => (
                        <li key={option.day}>
                          <DayButton
                            option={option}
                            selected={option.day === selectedDay}
                            onSelect={() => onSelectDay(option.day)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * 일자 버튼. **그날 항목 수를 함께 쓴다** — 몰림을 알리기 위해서다 (아트보드 02-A 주석).
 *
 * 이미 담긴 일자는 **잠그지 않고 표시만 한다.** 같은 장소를 다른 날에 또 들르는 일정이
 * 실제로 있고, 잠그면 그 계획을 세울 방법이 없다. 중복 방지는 같은 일자에 대해서만
 * 필요한데 그것은 담기 버튼이 막는다.
 */
function DayButton({
  option,
  selected,
  onSelect,
}: {
  option: AddToPlanDayOption
  selected: boolean
  onSelect: () => void
}) {
  const meta =
    option.date === null
      ? `${option.itemCount}곳`
      : messages.plan.addToPlanDayMeta
          .replace('{date}', option.date.slice(5))
          .replace('{count}', String(option.itemCount))

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'focus-visible:ring-brand-500 flex min-w-24 flex-col items-start gap-0.5 rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none',
        selected ? 'border-brand-700 bg-band' : 'border-border',
      )}
    >
      <span className="text-body-2 text-fg font-semibold">
        {messages.plan.addToPlanDayLabel.replace('{day}', String(option.day))}
      </span>
      <span className="text-caption text-fg-muted font-medium tabular-nums">{meta}</span>
      {option.already && (
        <span className="text-caption text-fg-muted font-medium">
          {messages.plan.addPlaceAlready}
        </span>
      )}
    </button>
  )
}
