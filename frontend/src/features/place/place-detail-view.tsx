'use client'

import { useEffect } from 'react'

import { useSelectedPet } from '@/features/nav/use-selected-pet'
import { PlaceDetailSection } from '@/features/place/place-detail-section'
import { usePlaceDetail } from '@/features/place/use-place-detail'
import { usePlaceSuitability } from '@/features/place/use-place-suitability'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { toPetCondition } from '@/lib/api/insight'
import { writeRecentPlaceId } from '@/lib/insight/recent-place'

/** 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function PlaceDetailView({ placeId, authed }: { placeId: string; authed: boolean }) {
  const query = usePlaceDetail(placeId)

  /**
   * 판정은 **선택된 반려견 기준**이다. 헤더 스위처에서 바꾸면 조건이 바뀌고 key 가 달라져
   * 재조회된다 — 목록 필터의 크기 축과 같은 스토어를 쓴다.
   *
   * 미로그인이면 `pet` 이 null 이고, 그때도 조회는 한다 (공개 API). 조건 없는 응답의
   * 날씨만 게스트 블록이 쓰고 **점수·근거는 쓰지 않는다** — 기준이 되는 반려견이 없다.
   */
  const { pet } = useSelectedPet()
  const suitability = usePlaceSuitability(placeId, toPetCondition(pet))

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
      // 장소 조회와 판정 조회는 **따로 실패한다.** 판정이 죽어도 기본 정보는 그대로 쓸모가 있다
      suitability={{
        data: suitability.data ?? null,
        loading: suitability.isPending,
        failed: suitability.isError,
        onRetry: () => void suitability.refetch(),
        petName: pet?.name ?? null,
        authed,
      }}
      petName={pet?.name ?? null}
      petSizeCode={pet?.sizeType.code ?? null}
      petSizeName={pet?.sizeType.name ?? null}
    />
  )
}
