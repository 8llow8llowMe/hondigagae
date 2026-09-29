import { Skeleton } from '@/components/skeleton'
import { cn } from '@/lib/utils/cn'

/**
 * 상세 스켈레톤 — **판정·항목 보강 자리에만** 쓴다.
 *
 * 일정 본문은 서버 프리페치라 첫 페인트에 이미 있다. 본문까지 스켈레톤으로 덮으면
 * 이미 가진 자료를 일부러 감추는 셈이다 (D5).
 *
 * **판정 밴드와 같은 칸이다** (`PlanDayVerdict` 의 `VERDICT_BAND_CLASS` — `my-4` · 테두리 ·
 * `px-4 py-3` · `gap-3`). 머리 줄은 [적합도 캡션 + 등급어 | 기온 캡션 + 값] 두 기둥이고,
 * 아래는 근거 두 줄이다 — 근거 개수는 날마다 달라 두 줄로 잡는다. 예전에는 이 골격이
 * 밴드 모양이 아니었고 아무 데서도 쓰이지 않아, 날씨를 기다리는 동안 판정 자리가 통째로
 * 비었다가 도착하는 순간 일자마다 밴드가 끼어들며 아래 항목이 밀렸다.
 *
 * 자료가 아니라 자리표시자라 `aria-hidden` 이다 — 스크린리더가 빈 상자를 읽지 않는다.
 */
export function PlanDayVerdictSkeleton() {
  return (
    <div aria-hidden className="border-border my-4 flex flex-col gap-3 rounded-md border px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <CaptionLine className="w-10" />
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <CaptionLine className="w-14" />
          <Skeleton className="h-7 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-4 w-2/3 max-w-sm" />
    </div>
  )
}

/** caption 한 줄(18) — 칸은 줄 높이, 막대만 가늘게 (`walk-verdict-skeleton.tsx` 와 같다) */
function CaptionLine({ className }: { className: string }) {
  return (
    <div className="flex h-4.5 items-center">
      <Skeleton className={cn('h-3.5', className)} />
    </div>
  )
}
