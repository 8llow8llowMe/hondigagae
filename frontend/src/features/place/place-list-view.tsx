'use client'

import { usePathname, useRouter } from 'next/navigation'

import { PlaceListSection } from '@/features/place/place-list-section'
import { usePlaceList } from '@/features/place/use-place-list'
import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import type { PlaceFilters } from '@/types/place'

/** 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function PlaceListView({ filters }: { filters: PlaceFilters }) {
  const router = useRouter()
  const pathname = usePathname()
  const query = usePlaceList(filters)

  const places = query.data === undefined ? [] : mergeSlices(query.data.pages)
  const lastPage = query.data?.pages.at(-1)

  return (
    <PlaceListSection
      places={places}
      loading={query.isPending}
      errorStatus={toStatus(query.error)}
      errorMessage={query.error instanceof ApiError ? query.error.rawMessage : undefined}
      hasNext={lastPage?.hasNext ?? false}
      loadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      onResetFilters={() => router.replace(pathname, { scroll: false })}
    />
  )
}

function toStatus(error: unknown): number | null {
  if (error === null || error === undefined) return null
  if (error instanceof ApiError) return error.status
  return NO_RESPONSE_STATUS
}
