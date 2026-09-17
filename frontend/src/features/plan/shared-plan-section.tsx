import { EmptyState } from '@/components/empty-state'
import { Surface, SurfaceList, SurfaceStack } from '@/components/surface'
import { PlanStatusBadge } from '@/features/plan/plan-status-badge'
import { SharedPlanItemRow } from '@/features/plan/shared-plan-item-row'
import { messages } from '@/lib/messages'
import { addPlanDays, formatPlanDateRange, weekdayOf } from '@/lib/plan/date'
import { groupItemsByDay } from '@/lib/plan/detail'
import { INSET_CLASS } from '@/lib/ui/inset'
import type { SharedPlan } from '@/types/plan'

/**
 * 공유받은 일정 — 읽기 전용 본문 (#628).
 *
 * **서버 컴포넌트다.** 뮤테이션·필터·폴링·재조회가 하나도 없어 `'use client'` 도
 * React Query 도 필요 없다. 페이지가 `serverFetch` 한 값을 그대로 받는다.
 *
 * **데스크톱에서 `.rail-layout` 을 쓰지 않는다.** 소유자 상세의 좌측 레일이 들고 있던
 * 것(반려견 · D-day · 관리 메뉴 · 상태 전환 버튼)이 **이 화면에는 하나도 없어** 빈 열이
 * 된다. 단일 칼럼으로 두고 `SurfaceStack` 이 폭을 잡는다.
 *
 * **자리를 만들지 않는 것들**: 예산 · 메모 · 준비물 · 후기 · 일자 판정 · 실내 대안 ·
 * 방문 체크. 응답에 없어서 못 그리는 것이고(`SharedPlanResponse`), 빈 카드를 두면
 * "불러오지 못했다" 로 읽힌다.
 */
export function SharedPlanSection({ plan }: { plan: SharedPlan }) {
  const { days, outOfRange } = groupItemsByDay(plan.items, plan.totalDays)

  return (
    <SurfaceStack>
      {/*
        제목 줄도 카드다 — 소유자 상세의 `PlanOverviewPanel` 과 같은 판정이다 (#553).
        `h1` 이 이 화면의 유일한 최상위 제목이다.
      */}
      <Surface aria-label={messages.plan.sharedPageTitle}>
        <div className={`${INSET_CLASS.card} py-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title-1 text-fg min-w-0 font-bold break-words">{plan.title}</h1>
            <PlanStatusBadge status={plan.status} />
          </div>

          <p className="text-body-2 text-fg-muted mt-2 font-medium tabular-nums">
            {formatPlanDateRange(plan.startDate, plan.endDate)}
            {' · '}
            {messages.plan.totalDays.replace('{days}', String(plan.totalDays))}
          </p>

          {/*
            **읽기 전용이라는 사실을 화면이 말한다.** 편집 버튼이 없는 것만으로는
            "아직 안 만들어진 화면" 과 구별되지 않는다.
          */}
          <p className="text-caption text-fg-subtle mt-3 font-medium">
            {messages.plan.sharedReadOnlyNote}
          </p>
        </div>
      </Surface>

      {days.map((group) => {
        const date = addPlanDays(plan.startDate, group.day - 1)
        const weekday = date === null ? null : weekdayOf(date)

        return (
          <Surface
            key={group.day}
            aria-label={messages.plan.dayLabel.replace('{day}', String(group.day))}
          >
            <div className={INSET_CLASS.card}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-5">
                <h2 className="text-title-1 text-fg font-bold">
                  {messages.plan.dayLabel.replace('{day}', String(group.day))}
                </h2>
                {date !== null && (
                  <span className="text-body-2 text-fg-muted font-medium tabular-nums">
                    {date.slice(5)}
                    {weekday === null ? '' : ` (${weekday})`}
                  </span>
                )}
              </div>
            </div>

            {/*
              **항목이 없는 일자도 섹션을 갖는다** — `totalDays` 가 섹션 수를 정한다
              (`groupItemsByDay`). 빈 일자를 접으면 받은 사람이 "3박인데 2일만 있다" 로
              읽는다. 다만 문구는 소유자 화면과 다르다 — 담을 수 있는 사람이 아니다.
            */}
            {group.items.length === 0 ? (
              <EmptyState
                title={messages.plan.sharedDayEmpty}
                inset="card"
                headingLevel={3}
                className="py-6"
              />
            ) : (
              <SurfaceList className="mt-4">
                {group.items.map((item) => (
                  <SharedPlanItemRow key={`${item.day}-${item.sequence}`} item={item} />
                ))}
              </SurfaceList>
            )}
          </Surface>
        )
      })}

      {/*
        기간 밖 항목 — 기간을 줄여도 서버가 항목을 정리하지 않아 생긴다. **숨기지
        않는다**: 숨기면 받은 사람이 일정의 일부를 못 본 채로 끝난다 (소유자 화면과 같은
        판단). 왜 밖에 있는지는 설명하지 않는다 — 고칠 수 있는 사람이 아니다.
      */}
      {outOfRange.length > 0 && (
        <Surface aria-label={messages.plan.outOfRangeTitle}>
          <div className={INSET_CLASS.card}>
            <h2 className="text-title-1 text-fg pt-5 font-bold">{messages.plan.outOfRangeTitle}</h2>
          </div>
          <SurfaceList className="mt-4">
            {outOfRange.map((item) => (
              <SharedPlanItemRow key={`out-${item.day}-${item.sequence}`} item={item} />
            ))}
          </SurfaceList>
        </Surface>
      )}
    </SurfaceStack>
  )
}
