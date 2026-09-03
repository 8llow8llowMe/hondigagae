'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { Button } from '@/components/button'
import { PlusIcon } from '@/components/icons'
import { usePetList } from '@/features/pet/use-pet-list'
import { PlanCreateSheet } from '@/features/plan/plan-create-sheet'
import { PlanFilterRail, PlanPetChips, PlanStatusTabs } from '@/features/plan/plan-filter-controls'
import { PlanListSection } from '@/features/plan/plan-list-section'
import { usePlanList } from '@/features/plan/use-plan-list'
import { toErrorStatus } from '@/lib/api/error'
import { hasMore, mergeSlices } from '@/lib/api/slice'
import { messages } from '@/lib/messages'
import { countByPet, countByStatus, filterPlans, hasActiveFilters } from '@/lib/plan/list'
import { toPlanFilterQuery } from '@/lib/url/plan-filters'
import { DEFAULT_PLAN_FILTERS, type PlanFilters } from '@/types/plan'

/**
 * 일정 목록 — 조회·좁히기를 끝내고 presentational 컴포넌트에 결과만 넘긴다.
 *
 * **필터는 URL 이 소유한다** (architecture-guide.md §10). 서버가 `searchParams` 를
 * 파싱해 내려주고 여기서는 `router.replace` 로 쓴다 — `push` 를 쓰면 필터를 만질 때마다
 * 히스토리가 쌓여 뒤로가기가 필터 되감기가 된다.
 *
 * **필터가 바뀌어도 재조회하지 않는다.** `GET /plans` 에 좁히기 파라미터가 없어
 * query key 에 필터가 들어가지 않는다 (`queries.ts`).
 */
export function PlanListView({ filters, today }: { filters: PlanFilters; today: Date }) {
  const router = useRouter()
  const pathname = usePathname()

  const [creating, setCreating] = useState(false)

  const plansQuery = usePlanList()
  const petsQuery = usePetList(true)
  // `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200)

  const pages = plansQuery.data?.pages
  const allPlans = useMemo(() => (pages === undefined ? [] : mergeSlices(pages)), [pages])
  const hasNext = pages === undefined ? false : hasMore(pages)

  const pets = petsQuery.data?.pets ?? []
  const petNames = useMemo(() => new Map(pets.map((pet) => [pet.petId, pet.name] as const)), [pets])

  /**
   * **아직 다 받지 않았으면 개수를 말하지 않는다** (공통명세 S3).
   *
   * 조건이 둘이다. `hasNext` 는 "더 있는데 안 받았다" 이고, `pages === undefined` 는
   * "아직 한 장도 못 받았다" 다. **후자를 빼먹으면 조회 중과 실패에 `일정 0개` ·
   * `전체 0 · 초안 0` 이 뜬다** — 스켈레톤이 도는 옆에서 0 을 단정하는 화면이 된다
   * (375 실렌더에서 확인).
   *
   * 상태 개수는 반려견 필터를 적용한 뒤 값이고, 반려견 개수는 상태 필터를 적용한 뒤
   * 값이다 — 두 축이 서로를 기준으로 센다 (아트보드 04 주석).
   */
  const countable = pages !== undefined && !hasNext
  const statusCounts = countable
    ? countByStatus(filterPlans(allPlans, { ...DEFAULT_PLAN_FILTERS, petIds: filters.petIds }))
    : null
  const petCounts = countable
    ? countByPet(filterPlans(allPlans, { ...DEFAULT_PLAN_FILTERS, status: filters.status }))
    : null

  const visible = filterPlans(allPlans, filters)

  function apply(next: PlanFilters) {
    const query = toPlanFilterQuery(next)
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false })
  }

  const section = (
    <PlanListSection
      plans={visible}
      totalCount={countable ? allPlans.length : null}
      petNames={petNames}
      today={today}
      loading={plansQuery.isPending}
      errorStatus={toErrorStatus(plansQuery.error)}
      hasNext={hasNext}
      loadingMore={plansQuery.isFetchingNextPage}
      filtered={hasActiveFilters(filters)}
      hasPets={pets.length > 0}
      firstPetName={pets[0]?.name ?? null}
      onLoadMore={() => void plansQuery.fetchNextPage()}
      onRetry={() => void plansQuery.refetch()}
      onResetFilters={() => apply(DEFAULT_PLAN_FILTERS)}
    />
  )

  return (
    <>
      {/* 2단은 1024+ 부터다. 280 레일 + 본문은 768 에 들어가지 않아 가로 스크롤이 난다 */}
      <div className="rail-sticky hidden lg:block">
        <PlanFilterRail
          filters={filters}
          onChange={apply}
          onReset={() => apply(DEFAULT_PLAN_FILTERS)}
          pets={pets}
          statusCounts={statusCounts}
          petCounts={petCounts}
        />
      </div>

      <div className="lg:border-border lg:border-l">
        <header className="flex items-start justify-between gap-4 px-4 pt-5 pb-3 md:px-10 lg:pt-6">
          <div className="min-w-0">
            <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
              {messages.plan.pageTitle}
            </h1>
            {countable && (
              <p className="text-caption text-fg-muted mt-1 font-medium tabular-nums">
                {messages.plan.countSummary.replace('{total}', String(allPlans.length))}
              </p>
            )}
          </div>

          {/*
            반려견이 없으면 만들기로 보내지 않는다 — `POST /plans` 에 `petId` 가 필수라
            폼을 채울 수 없다. 빈 상태(`NoPlans`)가 등록으로 안내한다.

            **AI 일정 생성 화면(#84)이 생겨 만들기 방식 시트를 켰다.** 아트보드 04 대로
            AI / 직접 두 항목을 시트로 고르게 한다. 그 전에는 선택지가 하나뿐이어서
            시트를 두지 않았다 (공통명세 S2).

            링크가 아니라 `Button` 인 이유: 이 버튼은 이동이 아니라 **시트를 여는
            조작**이다. 이동은 시트 안의 두 링크가 한다 (#70 과 같은 기준).
          */}
          {pets.length > 0 && (
            <>
              <Button className="hidden shrink-0 lg:inline-flex" onClick={() => setCreating(true)}>
                {messages.plan.createAction}
              </Button>
              {/* 모바일은 44×44 아이콘 버튼 — 라벨이 보이지 않아 aria-label 로 준다 */}
              <Button
                variant="ghost"
                iconOnly
                aria-label={messages.plan.createActionLabel}
                leading={<PlusIcon size={24} />}
                className="shrink-0 lg:hidden"
                onClick={() => setCreating(true)}
              />
            </>
          )}
        </header>

        <div className="lg:hidden">
          <PlanStatusTabs filters={filters} onChange={apply} statusCounts={statusCounts} />
          <PlanPetChips filters={filters} onChange={apply} pets={pets} />
        </div>

        {section}
      </div>

      <PlanCreateSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
