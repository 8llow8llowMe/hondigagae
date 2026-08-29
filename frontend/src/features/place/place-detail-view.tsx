'use client'

import { useEffect } from 'react'

import { PlaceDetailSection } from '@/features/place/place-detail-section'
import { usePlaceDetail } from '@/features/place/use-place-detail'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { writeRecentPlaceId } from '@/lib/insight/recent-place'

/** 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function PlaceDetailView({ placeId }: { placeId: string }) {
  const query = usePlaceDetail(placeId)

  /**
   * 홈의 산책 판정이 쓸 **기준 장소**를 남긴다 (공통명세 S5-1).
   *
   * 조회에 성공했을 때만 기록한다 — 404 인 placeId 를 남기면 홈이 없는 장소로 판정을
   * 조회해 그 섹션이 매번 실패한다.
   */
  useEffect(() => {
    if (query.data !== undefined) writeRecentPlaceId(placeId)
  }, [placeId, query.data])

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
