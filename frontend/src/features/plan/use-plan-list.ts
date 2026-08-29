'use client'

import { useInfiniteQuery } from '@tanstack/react-query'

import { planKeys, planListQueryOptions } from '@/features/plan/queries'
import { fetchPlanList, nextPlanCursor, type PlanSlice } from '@/lib/api/plan'

/**
 * 내 일정 목록. 서버 프리페치가 1페이지를 심어 두고 여기서 이어받는다 —
 * **key 가 같아야 프리페치가 살아난다** (architecture-guide.md §9).
 */
export function usePlanList() {
  return useInfiniteQuery({
    queryKey: planKeys.list(),
    queryFn: ({ pageParam }) => fetchPlanList(pageParam),
    initialPageParam: planListQueryOptions.initialPageParam,
    getNextPageParam: (last: PlanSlice) => nextPlanCursor(last) ?? null,
    staleTime: planListQueryOptions.staleTime,
    gcTime: planListQueryOptions.gcTime,
  })
}
