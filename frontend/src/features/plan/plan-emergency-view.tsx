'use client'

import { useQuery } from '@tanstack/react-query'

import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { PlanEmergencySection } from '@/features/plan/plan-emergency-section'
import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { fetchPlanEmergency } from '@/lib/api/plan'
import { messages } from '@/lib/messages'

/**
 * 일정 응급 브리핑 화면 (#125).
 *
 * **서버 프리페치를 하지 않는다.** 라우트가 일정 상세만 프리페치해 404 를 가리고, 이
 * 조회는 반경 10km × 방문 장소 수만큼 외부 조회가 걸려 서버 렌더를 붙잡기 쉽다 —
 * 실패해도 화면 골격(제목·돌아가기)은 서 있어야 한다.
 */
export function PlanEmergencyView({ planId }: { planId: string }) {
  const emergency = useQuery({
    queryKey: planKeys.emergency(planId),
    queryFn: () => fetchPlanEmergency(planId),
    ...PLAN_QUERY_OPTIONS,
  })

  if (emergency.isPending) return <PlanEmergencySkeleton />

  if (emergency.isError || emergency.data === undefined) {
    return (
      <ErrorState
        title={messages.plan.emergencyErrorTitle}
        onRetry={() => void emergency.refetch()}
      />
    )
  }

  return <PlanEmergencySection data={emergency.data} />
}

function PlanEmergencySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-4 py-4 md:px-10">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
