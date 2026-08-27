'use client'

import { PlaceDetailSection } from '@/features/place/place-detail-section'
import { usePlaceDetail } from '@/features/place/use-place-detail'
import { ApiError, toErrorStatus } from '@/lib/api/error'

/** 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function PlaceDetailView({ placeId }: { placeId: string }) {
  const query = usePlaceDetail(placeId)

  return (
    <PlaceDetailSection
      place={query.data ?? null}
      loading={query.isPending}
      errorStatus={toErrorStatus(query.error)}
      errorMessage={query.error instanceof ApiError ? query.error.rawMessage : undefined}
      onRetry={() => void query.refetch()}
    />
  )
}
