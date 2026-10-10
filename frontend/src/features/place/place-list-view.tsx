'use client'

import { PlaceListSection } from '@/features/place/place-list-section'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { usePlaceList } from '@/features/place/use-place-list'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import type { PlaceFilters } from '@/types/place'

/** 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function PlaceListView({ filters }: { filters: PlaceFilters }) {
  /*
    **초기화도 `usePlaceFilterNav` 를 거친다.** 여기서 `router.replace(pathname)` 를 직접
    조립하면 `?view=list` 가 떨어져 목록에서 초기화를 누른 사용자가 지도로 튄다 —
    필터 컨트롤이 같은 이유로 훅을 공유하는 것과 같은 규칙이다.
  */
  const { reset } = usePlaceFilterNav()
  const query = usePlaceList(filters)

  const places = query.data === undefined ? [] : mergeSlices(query.data.pages)
  const lastPage = query.data?.pages.at(-1)

  return (
    <PlaceListSection
      /*
        **제목을 한 단 내린다** (#456①). 이 목록을 담는 카드는 페이지가 그리고
        (`app/(main)/places/(list)/page.tsx` 의 `<Surface lead titleId="place-list-heading">`)
        그 카드가 `h2` 를 이미 갖는다. 세 사용처 중 여기만 `3` 이다 — 담기 화면과 지도
        폴백은 제목 있는 카드가 아니라 기본값 `2` 로 둔다.
      */
      /*
        **카드가 제목을 되찾아 `3` 이다** (#556). #531 이 제목 줄을 카드 밖으로 올렸을 때는
        `2` 였는데, 제목·검색이 카드 머리로 들어오면서 카드가 다시 `h2` 를 그린다.
        값을 지워 기본값에 맡기지 않는 것은 "이 카드가 제목을 갖는가" 라는 판단을 소스에
        남겨 두기 위해서다 (`state-heading-level.test.ts` 가 짝).
      */
      headingLevel={3}
      /*
        **2열은 이 화면만이다** (#531). `xl`(1280)+ 에서만 접히고, 담기 화면·지도 폴백은
        폭이 좁아 기본값 1열로 남는다 — 열 수를 담는 곳이 정하는 이유다.
      */
      columns={2}
      // 0건 문구가 무엇으로 찾았는지 되돌려 준다 (#431)
      keyword={filters.keyword}
      places={places}
      loading={query.isPending}
      errorStatus={toErrorStatus(query.error)}
      errorMessage={query.error instanceof ApiError ? query.error.rawMessage : undefined}
      hasNext={lastPage?.hasNext ?? false}
      loadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      onResetFilters={reset}
    />
  )
}
