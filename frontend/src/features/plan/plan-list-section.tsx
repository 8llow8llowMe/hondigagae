import { Button, ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Band, RowList } from '@/components/surface'
import { PlanListSkeleton } from '@/features/plan/plan-list-skeleton'
import { PlanRow } from '@/features/plan/plan-row'
import { messages } from '@/lib/messages'
import { groupPlans } from '@/lib/plan/list'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 일정 목록 본문 — 아트보드 04 · 05 · 06.
 *
 * presentational 이다. 조회·좁히기는 `PlanListView` 가 끝내고 결과만 내려온다.
 *
 * **오류는 섹션 단위다.** 반려견 조회가 실패해도 목록은 그대로 보인다 — 일정 자료는
 * 우리 DB 이고 반려견은 다른 서비스다 (공통명세 S8).
 */
export type PlanListSectionProps = {
  /** 이미 좁혀진 목록 */
  plans: PlanSummaryItem[]
  /** 좁히기 전 전체 개수. `hasNext` 면 셀 수 없어 null 이다 */
  totalCount: number | null
  petNames: Map<string, string>
  today: Date
  loading: boolean
  errorStatus: number | null
  hasNext: boolean
  loadingMore: boolean
  filtered: boolean
  /** 반려견이 하나도 없으면 만들기 대신 등록을 권한다 */
  hasPets: boolean
  firstPetName: string | null
  onLoadMore: () => void
  onRetry: () => void
  onResetFilters: () => void
}

export function PlanListSection({
  plans,
  totalCount,
  petNames,
  today,
  loading,
  errorStatus,
  hasNext,
  loadingMore,
  filtered,
  hasPets,
  firstPetName,
  onLoadMore,
  onRetry,
  onResetFilters,
}: PlanListSectionProps) {
  if (loading) return <PlanListSkeleton />

  if (errorStatus !== null) {
    return (
      <ErrorState
        title={messages.plan.errorTitle}
        description={messages.plan.errorDescription}
        onRetry={onRetry}
      />
    )
  }

  if (plans.length === 0) {
    return filtered ? (
      <FilteredEmpty totalCount={totalCount} onResetFilters={onResetFilters} />
    ) : (
      <NoPlans hasPets={hasPets} firstPetName={firstPetName} />
    )
  }

  const { upcoming, past } = groupPlans(plans, today)

  return (
    <div className="pb-6">
      {upcoming.length > 0 && (
        <PlanGroup
          title={messages.plan.sectionUpcoming}
          plans={upcoming}
          petNames={petNames}
          today={today}
        />
      )}

      {/* 두 묶음 사이는 8px 밴드로 끊는다 — 구분선 하나로는 같은 목록의 연속으로 읽힌다 */}
      {upcoming.length > 0 && past.length > 0 && <Band />}

      {past.length > 0 && (
        <PlanGroup
          title={messages.plan.sectionPast}
          plans={past}
          petNames={petNames}
          today={today}
        />
      )}

      {hasNext && (
        <div className="px-4 pt-4 md:px-10">
          <Button variant="secondary" className="w-full" loading={loadingMore} onClick={onLoadMore}>
            {messages.plan.loadMore}
          </Button>
        </div>
      )}
    </div>
  )
}

function PlanGroup({
  title,
  plans,
  petNames,
  today,
}: {
  title: string
  plans: PlanSummaryItem[]
  petNames: Map<string, string>
  today: Date
}) {
  return (
    <section>
      <h2 className="text-caption text-fg-muted px-4 pt-4 pb-1 font-semibold md:px-10">{title}</h2>
      <RowList>
        {plans.map((plan, index) => (
          <PlanRow
            key={plan.planId}
            plan={plan}
            petName={petNames.get(plan.petId) ?? null}
            today={today}
            last={index === plans.length - 1}
          />
        ))}
      </RowList>
    </section>
  )
}

/**
 * 필터 결과 없음 — 아트보드 05.
 *
 * **"지우면 몇 개가 있는지" 를 문장에 넣는다.** 그 숫자도 전량을 받았을 때만 말한다
 * (공통명세 S3).
 */
function FilteredEmpty({
  totalCount,
  onResetFilters,
}: {
  totalCount: number | null
  onResetFilters: () => void
}) {
  return (
    <EmptyState
      title={messages.plan.filteredEmptyTitle}
      description={
        totalCount === null
          ? messages.plan.filteredEmptyDescriptionUnknown
          : messages.plan.filteredEmptyDescription.replace('{total}', String(totalCount))
      }
      action={
        <Button variant="secondary" onClick={onResetFilters}>
          {messages.plan.filterReset}
        </Button>
      }
    />
  )
}

/**
 * 일정 없음 — 아트보드 06 ①. **AI 진입점을 넣지 않는다** (공통명세 S2).
 *
 * 반려견이 0마리면 만들기가 아니라 등록으로 보낸다 — `POST /plans` 에 `petId` 가
 * 필수라 반려견 없이는 폼을 채울 수 없다.
 */
function NoPlans({ hasPets, firstPetName }: { hasPets: boolean; firstPetName: string | null }) {
  if (!hasPets) {
    return (
      <EmptyState
        title={messages.plan.noPetTitle}
        description={messages.plan.noPetDescription}
        action={<ButtonLink href="/pets/new">{messages.plan.noPetAction}</ButtonLink>}
      />
    )
  }

  return (
    <EmptyState
      title={messages.plan.emptyTitle}
      description={
        firstPetName === null
          ? messages.plan.emptyDescription
          : messages.plan.emptyDescriptionWithPet.replace('{pet}', firstPetName)
      }
      action={<ButtonLink href="/plans/new">{messages.plan.createAction}</ButtonLink>}
    />
  )
}
