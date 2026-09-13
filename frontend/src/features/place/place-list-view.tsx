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
      headingLevel={3}
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
