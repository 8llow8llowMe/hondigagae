'use client'

import { useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { suitabilityPath } from '@/lib/api/insight'
import { conditionKey, INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import type { PetCondition, PlaceSuitabilityResponse } from '@/types/insight'

/**
 * 이 장소의 적합도 판정.
 *
 * key 를 홈과 **공유한다** (`insightKeys`) — 홈에서 이미 받아 둔 판정이 있으면 상세가
 * 다시 부르지 않는다. 조건이 key 에 들어 있어 반려견을 바꾸면 재조회된다.
 *
 * `placeholderData` 로 이전 값을 유지한다. 반려견 전환에서 스켈레톤으로 되돌아가면
 * "바꾼 게 반영됐나" 를 알 수 없다 (홈-세부명세 D4-2 와 같은 판단).
 *
 * **미로그인이어도 조회한다.** 인사이트는 공개 API 이고, 조건 없이 부르면 반려견을
 * 반영하지 않은 일반 판정이 온다 — 그 응답의 날씨만 게스트 블록이 쓴다.
 */
export function usePlaceSuitability(placeId: string, condition: PetCondition | null) {
  return useQuery({
    queryKey: insightKeys.suitability(placeId, conditionKey(condition)),
    queryFn: () => clientFetch<PlaceSuitabilityResponse>(suitabilityPath(placeId, condition)),
    placeholderData: (previous) => previous,
    ...INSIGHT_QUERY_OPTIONS,
  })
}
