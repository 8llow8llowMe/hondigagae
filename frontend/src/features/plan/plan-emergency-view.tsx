'use client'

import { useQuery } from '@tanstack/react-query'

import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { Surface } from '@/components/surface'
import { PlanEmergencyHeader, PlanEmergencySection } from '@/features/plan/plan-emergency-section'
import { PLAN_QUERY_OPTIONS, planKeys } from '@/features/plan/queries'
import { fetchPlanEmergency } from '@/lib/api/plan'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 일정 응급 브리핑 화면 (#125).
 *
 * **서버 프리페치를 하지 않는다.** 라우트가 일정 상세만 프리페치해 404 를 가리고, 이
 * 조회는 반경 10km × 방문 장소 수만큼 외부 조회가 걸려 서버 렌더를 붙잡기 쉽다 —
 * 실패해도 화면 골격(제목·돌아가기)은 서 있어야 한다.
 *
 * **머리까지 이 뷰가 그린다** (#460). 반경 안내가 응답에서 오는데 머리는 `h1` 과 한 덩어리라,
 * 페이지(서버)가 머리를 그리면 안내 줄이 다른 스택 자식으로 떨어져 사이에 카드 간격(24)이
 * 생긴다. 이 뷰가 `SurfaceStack` 의 직접 자식 둘 — 머리와 카드(들) — 을 fragment 로 돌려준다.
 *
 * **로딩·오류는 `Surface aria-label` 하나 안이다.** 데이터가 오면 일자 카드 N장으로 바뀌지만,
 * 그 전까지 카드 없는 바닥 위에 골격만 두면 응답 순간 표면이 통째로 생긴다 (#443 이 스켈레톤을
 * 카드 리듬에 맞춘 이유). 제목이 없는 카드라 `aria-label` 이다 (`Surface` 머리주석).
 */
export function PlanEmergencyView({ planId }: { planId: string }) {
  const emergency = useQuery({
    queryKey: planKeys.emergency(planId),
    queryFn: () => fetchPlanEmergency(planId),
    ...PLAN_QUERY_OPTIONS,
  })

  return (
    <>
      <PlanEmergencyHeader planId={planId} radiusMeters={emergency.data?.radiusMeters ?? null} />

      {emergency.isPending ? (
        <Surface aria-label={messages.plan.emergencyHeading} aria-busy>
          <PlanEmergencySkeleton />
        </Surface>
      ) : emergency.isError || emergency.data === undefined ? (
        <Surface aria-label={messages.plan.emergencyHeading}>
          <ErrorState
            title={messages.plan.emergencyErrorTitle}
            onRetry={() => void emergency.refetch()}
            inset="card"
          />
        </Surface>
      ) : (
        <PlanEmergencySection data={emergency.data} />
      )}
    </>
  )
}

function PlanEmergencySkeleton() {
  return (
    <div aria-hidden className={cn('flex flex-col gap-3 py-4', INSET_CLASS.card)}>
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
