import { Button, ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SurfaceList } from '@/components/surface'
import { PlanListSkeleton } from '@/features/plan/plan-list-skeleton'
import { PlanRow } from '@/features/plan/plan-row'
import { messages } from '@/lib/messages'
import { companionNamesOf } from '@/lib/plan/companion-pets'
import { groupPlans } from '@/lib/plan/list'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 일정 목록 본문 — 아트보드 04 · 05 · 06.
 *
 * presentational 이다. 조회·좁히기는 `PlanListView` 가 끝내고 결과만 내려온다.
 *
 * **오류는 섹션 단위다.** 반려견 조회가 실패해도 목록은 그대로 보인다 — 일정 자료는
 * 우리 DB 이고 반려견은 다른 서비스다 (공통명세 S8).
 *
 * **L1 카드 안이다** (`DESIGN.md §0`, #445). 카드는 `PlanListView` 의 `Surface` 가 만들고 여기는
 * 그 안의 L2 만 그린다 — 로딩·오류·빈 상태·목록 넷이 전부 카드 안이라 상태에 따라 경계가
 * 생겼다 사라지지 않는다 (#439 와 같은 판단).
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

  /*
    **네 상태 전부 `headingLevel={3}` 이다** (#456①). 카드는 이 파일이 아니라 호출부
    (`plan-list-view.tsx` 의 `<Surface lead titleId="plan-list-heading">`)가 그리는데,
    **호출부가 하나뿐이고 그 카드가 제목을 갖는다.** prop 으로 뚫지 않은 이유가 그것이다 —
    값이 갈리는 화면이 아직 없다 (#422 의 "미리 만들지 않는다").
    갈리는 날 `PlaceListSection` · `EmergencySection` 처럼 `담는 곳이 정한다` 로 바꾼다.
    이 짝은 `state-heading-level.test.ts` 가 정상 화면 쪽과 함께 잠근다.
  */
  if (errorStatus !== null) {
    return (
      <ErrorState
        headingLevel={3}
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
    <div className="pb-5">
      {upcoming.length > 0 && (
        <PlanGroup
          title={messages.plan.sectionUpcoming}
          plans={upcoming}
          petNames={petNames}
          today={today}
        />
      )}

      {/*
        **두 묶음은 한 카드 안의 L2 다.** 같은 화자(내 일정)가 시간으로 나눈 것이라 카드를
        둘로 쪼개지 않는다 — §0 "카드 경계는 이야기 단위". 2a 는 둘 사이를 8px 밴드로 끊었는데,
        3a 의 카드 안에서는 밴드가 각진 불투명 면이 되어 카드 모서리를 덮는다. 뒤 묶음의
        제목 줄 위에 **1px 구분선**을 그어 가른다 — 캡션 제목이 함께 있어 목록의 연속으로
        읽히지 않는다.
      */}
      {past.length > 0 && (
        <PlanGroup
          title={messages.plan.sectionPast}
          plans={past}
          petNames={petNames}
          today={today}
          divided={upcoming.length > 0}
        />
      )}

      {hasNext && (
        <div className={cn('pt-4', INSET_CLASS.card)}>
          <Button variant="secondary" className="w-full" loading={loadingMore} onClick={onLoadMore}>
            {messages.plan.loadMore}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * 한 묶음 — 캡션 제목 + 행 목록. 카드 제목이 `h2` 라 묶음 제목은 `h3` 다.
 * 인셋은 카드 안 값(16/20)이고, 구분선은 `SurfaceList` 가 행 사이에만 긋는다.
 */
function PlanGroup({
  title,
  plans,
  petNames,
  today,
  divided = false,
}: {
  title: string
  plans: PlanSummaryItem[]
  petNames: Map<string, string>
  today: Date
  /** 앞 묶음이 있으면 위에 1px 선을 긋는다 */
  divided?: boolean
}) {
  return (
    <section className={divided ? 'border-border mt-2 border-t' : undefined}>
      <h3 className={cn('text-caption text-fg-muted pt-3 pb-1 font-semibold', INSET_CLASS.card)}>
        {title}
      </h3>
      <SurfaceList>
        {plans.map((plan) => (
          <PlanRow
            key={plan.planId}
            plan={plan}
            /* 대표(`plan.petId`)가 아니라 동행 전체다 (#218) */
            petNames={companionNamesOf(plan.petIds, petNames)}
            today={today}
          />
        ))}
      </SurfaceList>
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
      headingLevel={3}
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
        headingLevel={3}
        title={messages.plan.noPetTitle}
        description={messages.plan.noPetDescription}
        action={<ButtonLink href="/pets/new">{messages.plan.noPetAction}</ButtonLink>}
      />
    )
  }

  return (
    <EmptyState
      headingLevel={3}
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
