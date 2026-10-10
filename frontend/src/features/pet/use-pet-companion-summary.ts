'use client'

import { useQuery } from '@tanstack/react-query'

import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { fetchPlanCompanionSummary } from '@/lib/api/plan'

/**
 * 반려견 삭제 확인창의 동행 일정 집계 (#1042).
 *
 * **확인창을 열 때만 받는다** (`enabled`). 수정 화면에 들어온 사람 대부분은 지우러 온 것이
 * 아니다 — 진입마다 plan-service 를 부르면 쓰지 않을 왕복이 생기고, 서버 프리페치 대상도
 * 아니다(첫 화면에 없는 값이다, architecture-guide §9 확정표).
 *
 * 값의 원천이 일정이라 **일정 표준값(30초 / 10분)** 을 쓴다. 일정을 만들거나 동행견을 바꾸면
 * `planKeys.all` 무효화가 이 key 도 함께 낡게 한다. retry 는 전역 기본(5xx·무응답만)이다 —
 * 이 조회에는 404 갈래가 없다.
 */
export function usePetCompanionSummary(petId: string, enabled: boolean) {
  return useQuery({
    queryKey: planKeys.companions(petId),
    queryFn: () => fetchPlanCompanionSummary(petId),
    enabled,
    staleTime: PLAN_QUERY_OPTIONS.staleTime,
    gcTime: PLAN_QUERY_OPTIONS.gcTime,
  })
}
