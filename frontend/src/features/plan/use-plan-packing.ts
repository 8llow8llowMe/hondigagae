'use client'

import { useQuery } from '@tanstack/react-query'

import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { fetchPackingItems } from '@/lib/api/plan'

/**
 * 준비물 목록 조회 (#155 · #586). **두 곳이 구독한다** (#732).
 *
 * 하나는 카드 자신(`PlanPackingList`)이고, 다른 하나는 **카드의 자리를 정하는**
 * `PlanDetailSection` 이다 — 승격 조건에 "담을 것이 실제로 있는가" 가 들어오면서, 자리를
 * 정하는 쪽도 목록을 봐야 한다.
 *
 * **`useQuery` 를 둘 두는 것이 카드를 둘 두는 것과 다르다.** 같은 query key 라 요청은
 * 하나이고 캐시도 하나다 — 늘어나는 것은 구독자뿐이다. `plan-detail-section.tsx` 가
 * 경계하는 것(D11-9-3)은 **카드를 두 자리에 렌더하고 한쪽을 `hidden` 으로 두는 것**이고,
 * 그쪽은 스크린리더가 두 번 읽고 DOM 도 둘이 된다. 여기서는 카드가 여전히 하나다.
 *
 * **옵션을 여기 모은다.** 두 호출부가 `staleTime` 을 따로 적으면 한쪽만 고치는 날이 온다.
 */
export function usePlanPackingList(planId: string) {
  return useQuery({
    queryKey: planKeys.packing(planId),
    queryFn: () => fetchPackingItems(planId),
    ...PLAN_QUERY_OPTIONS,
  })
}
