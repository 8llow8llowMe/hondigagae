'use client'

import { useQuery } from '@tanstack/react-query'

import { clientFetch } from '@/lib/api/client'
import { walkSafetyPath } from '@/lib/api/insight'
import { conditionKey, INSIGHT_QUERY_OPTIONS, insightKeys } from '@/lib/insight/queries'
import type { PetCondition, WalkSafetyResponse } from '@/types/insight'

/**
 * 이 장소의 산책 위험도 (#197).
 *
 * **적합도와 별도 query 다.** 같은 화면에 나란히 서지만 엔드포인트가 다르고
 * (`PlaceInsightWebController` 의 두 메서드) **한쪽만 실패할 수 있다** — 적합도가 죽어도
 * 노면 온도는 쓸모가 있고 그 반대도 같다. 하나로 묶으면 둘 다 잃는다.
 *
 * key 를 홈과 **공유한다** (`insightKeys.walkSafety`) — 홈이 이 장소를 기준 장소로 삼고
 * 있었으면 (`writeRecentPlaceId` 로 남긴 그 장소다) 요청이 아예 나가지 않는다.
 * `usePlaceSuitability` 와 같은 판단이다.
 *
 * `placeholderData` 로 이전 값을 유지한다. 반려견을 바꿀 때 스켈레톤으로 되돌아가면
 * "바꾼 게 반영됐나" 를 알 수 없다.
 *
 * **미로그인이어도 조회한다.** 인사이트는 공개 API 이고, 조건 없이 부르면 반려견을
 * 반영하지 않은 일반 판정이 온다 — 노면 온도·열지수는 장소와 시각의 속성이라 반려견이
 * 없어도 값 자체가 참이다 (적합도의 점수와 다른 점이다).
 */
export function usePlaceWalkSafety(placeId: string, condition: PetCondition | null) {
  return useQuery({
    queryKey: insightKeys.walkSafety(placeId, conditionKey(condition)),
    queryFn: () => clientFetch<WalkSafetyResponse>(walkSafetyPath(placeId, condition)),
    placeholderData: (previous) => previous,
    ...INSIGHT_QUERY_OPTIONS,
  })
}
