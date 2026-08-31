'use client'

import { useMemo } from 'react'

import { useQueries } from '@tanstack/react-query'

import { PLACE_QUERY_OPTIONS, placeKeys } from '@/features/place/queries'
import { draftPlaceIds } from '@/lib/ai-plan/draft-to-plan'
import { clientFetch } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'
import { placeDetailPath } from '@/lib/api/place'
import type { AiPlanDraft } from '@/types/ai-plan'
import type { PlaceDetail } from '@/types/place'

/**
 * 초안 항목 보강 — 명세 S6.
 *
 * 초안에는 주소가 없다 → **항목당 `GET /places/{placeId}`**. 방식과 캐시 키는 일정
 * 상세와 같다 (`features/plan/일정상세-세부명세.md` D3) — **`placeKeys.detail()` 을
 * 재사용**해야 장소 상세를 이미 본 항목이 요청 없이 채워진다.
 *
 * **`placeId` 가 null 인 항목은 부르지 않는다.** 이동 항목과 검증되지 않은 장소다.
 * `WALK` 도 부르지 않는다 — 그 `placeId` 는 `walk_course.id` 와 어긋나 있어(#89)
 * 보강 결과를 신뢰할 수 없다 (`draftPlaceIds` 가 걸러낸다).
 *
 * **404 를 실패로 다루지 않는다.** 원천에서 사라진 장소(delisting)라 담기가 `PLAN_004`
 * 로 막힐 원인 후보다 — 그 항목을 지목하기 위해 따로 모은다 (명세 S5 함정 3).
 */
export function useDraftPlaces(draft: AiPlanDraft | null) {
  const placeIds = useMemo(() => (draft === null ? [] : draftPlaceIds(draft)), [draft])

  const results = useQueries({
    queries: placeIds.map((placeId) => ({
      queryKey: placeKeys.detail(placeId),
      queryFn: () => clientFetch<PlaceDetail>(placeDetailPath(placeId)),
      staleTime: PLACE_QUERY_OPTIONS.staleTime,
      gcTime: PLACE_QUERY_OPTIONS.gcTime,
      /*
        **404 는 재시도하지 않는다** — 사라진 장소는 다시 물어도 없다. 전역 기본값이
        이미 404 를 제외하지만, 여기서는 항목이 여러 개라 재시도가 겹치면 미리보기가
        늦게 채워진다.
      */
      retry: false,
    })),
  })

  return useMemo(() => {
    const addresses = new Map<string, string>()
    const delisted = new Set<string>()

    results.forEach((result, index) => {
      const placeId = placeIds[index]
      if (placeId === undefined) return

      if (result.error instanceof ApiError && result.error.status === 404) {
        delisted.add(placeId)
        return
      }

      const detail = result.data
      if (detail === undefined) return

      // `addr2` 는 상세 주소라 목록 행에는 붙이지 않는다 — 한 줄이 길어진다
      const address = detail.addr1?.trim()
      if (address !== undefined && address !== '') addresses.set(placeId, address)
    })

    return {
      addresses,
      delistedPlaceIds: delisted,
      /** 아직 채워지는 중인가. 미리보기를 막지는 않는다 — 주소가 늦게 붙을 뿐이다 */
      loading: results.some((result) => result.isPending),
    }
  }, [results, placeIds])
}
