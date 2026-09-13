'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { Button } from '@/components/button'
import { PlusIcon } from '@/components/icons'
import { SkipLink } from '@/components/skip-link'
import { Surface, SurfaceStack } from '@/components/surface'
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
      {/*
        **`h1` 이 문서의 첫 제목이다** (#472). 예전에는 이것이 목록 카드와 같은 열 안에
        있어, 제목으로 탐색하면 `h2 필터` 와 그 하위가 **페이지 제목보다 먼저** 나왔다.
        보이는 제목은 여전히 카드의 `h2` 다 — `sr-only` 는 `position: absolute` 라
        자리도 grid 트랙도 만들지 않는다.
      */}
      <h1 className="sr-only">{messages.plan.pageTitle}</h1>

      {/*
        2단은 1024+ 부터다. 280 레일 + 본문은 768 에 들어가지 않아 가로 스크롤이 난다.

        **`aside` 다 — `complementary` 랜드마크** (#472). 레일은 목록을 좁히는 도구이고
        본문이 아니다. 랜드마크로 내보내야 보조기기가 통째로 건너뛸 수 있다.
        **건너뛰기 링크**는 전역 스킵 링크(`#main`)가 레일 **앞**으로 보내 이 구간을
        못 건너뛰는 것을 메운다. `relative` 는 그 링크가 레일 좌상단에 뜨게 한다.
      */}
      <aside
        aria-label={messages.plan.filterTitle}
        className="rail-sticky relative hidden lg:block"
      >
        <SkipLink href="#plan-list">{messages.common.skipToList}</SkipLink>
        <PlanFilterRail
          filters={filters}
          onChange={apply}
          onReset={() => apply(DEFAULT_PLAN_FILTERS)}
          pets={pets}
          statusCounts={statusCounts}
          petCounts={petCounts}
        />
      </aside>

      {/*
        **3층 표면** (`DESIGN.md §0`, 이슈 #445). 우측 열은 `SurfaceStack` 하나고 목록이 L1 카드
        하나다 — 장소 목록(#439)과 같은 모양. **열 구분선을 걷었다** — L0 바닥이 열 사이로
        비쳐 그 일을 한다.
      */}
      <SurfaceStack id="plan-list" tabIndex={-1}>
        {/*
          **필터는 카드 밖이다.** 상태 탭·반려견 칩은 목록을 좁히는 **도구**이고 카드는 그
          결과를 담는다 — 데스크톱 레일이 카드 밖에 서 있는 것과 같은 자리다 (#439 와 같은 판단).
        */}
        <div className="lg:hidden">
          <PlanStatusTabs filters={filters} onChange={apply} statusCounts={statusCounts} />
          <PlanPetChips filters={filters} onChange={apply} pets={pets} />
        </div>

        {/*
          **페이지 제목이 카드 제목으로 들어왔다** (§0 "섹션 제목은 섹션 안에 있다"). 카드가
          하나뿐이고 그 이름이 곧 페이지의 이름이라, 밖에 두면 어느 묶음의 제목인지 모호해진다.
          보이는 제목은 카드의 `h2`, 페이지의 `h1` 은 `sr-only` — 장소 목록(#439)과 같은 방식이다.
        */}
        <Surface
          lead
          titleId="plan-list-heading"
          title={messages.plan.pageTitle}
          /* 개수는 전량을 받았을 때만 말한다 (공통명세 S3) — `countable` 이 그 조건이다 */
          description={
            countable && (
              <p className="text-caption text-fg-muted font-medium tabular-nums">
                {messages.plan.countSummary.replace('{total}', String(allPlans.length))}
              </p>
            )
          }
          /*
            반려견이 없으면 만들기로 보내지 않는다 — `POST /plans` 에 `petId` 가 필수라
            폼을 채울 수 없다. 빈 상태(`NoPlans`)가 등록으로 안내한다.

            **AI 일정 생성 화면(#84)이 생겨 만들기 방식 시트를 켰다.** 아트보드 04 대로
            AI / 직접 두 항목을 시트로 고르게 한다. 그 전에는 선택지가 하나뿐이어서
            시트를 두지 않았다 (공통명세 S2).

            링크가 아니라 `Button` 인 이유: 이 버튼은 이동이 아니라 **시트를 여는
            조작**이다. 이동은 시트 안의 두 링크가 한다 (#70 과 같은 기준).
          */
          trailing={
            pets.length > 0 ? (
              <>
                <Button className="hidden lg:inline-flex" onClick={() => setCreating(true)}>
                  {messages.plan.createAction}
                </Button>
                {/* 모바일은 44×44 아이콘 버튼 — 라벨이 보이지 않아 aria-label 로 준다 */}
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={messages.plan.createActionLabel}
                  leading={<PlusIcon size={24} />}
                  className="lg:hidden"
                  onClick={() => setCreating(true)}
                />
              </>
            ) : undefined
          }
        >
          {section}
        </Surface>
      </SurfaceStack>

      <PlanCreateSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
