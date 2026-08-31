import { Skeleton } from '@/components/skeleton'

/**
 * 상세 스켈레톤 — **판정·항목 보강 자리에만** 쓴다.
 *
 * 일정 본문은 서버 프리페치라 첫 페인트에 이미 있다. 본문까지 스켈레톤으로 덮으면
 * 이미 가진 자료를 일부러 감추는 셈이다 (D5).
 *
 * 자료가 아니라 자리표시자라 `aria-hidden` 이다 — 스크린리더가 빈 상자를 읽지 않는다.
 */
export function PlanDayVerdictSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 py-4">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-4 w-2/3 max-w-sm" />
    </div>
  )
}
