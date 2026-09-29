import { Skeleton } from '@/components/skeleton'
import { cn } from '@/lib/utils/cn'

/**
 * 오늘 산책 판정(`WalkVerdict`)의 대기 모양 — `HomeView` 의 `walkSafety.isPending` 과
 * 홈 `loading.tsx` 가 **같은 것을 쓴다.**
 *
 * **날짜가 판정 자리에 선다.** 판정이 오면 날짜는 `WalkVerdict` 의 등급 줄 바로 위
 * caption 이 된다(#530). 예전 골격에는 그 줄이 없어 날짜가 카드 맨 위(프로필 위)에 섰다가
 * 판정이 오는 순간 프로필 아래로 내려앉았다 — 로딩 중에도 **도착할 자리에서** 뜬다.
 *
 * 치수는 `WalkVerdict` 의 실측이다 (390 · 1280, 2026-09-29).
 * - **모바일** — 접힌 한 줄(`px-4 py-3`): 날짜 18 · 등급 줄 28 · 요약 18 = 본문 64
 * - **데스크톱** — 펼친 패널(`py-5 px-5`, `gap-3`): [날짜 + 등급 | 체감온도 hero] 한 줄 ·
 *   기준 줄 · 설명 한 줄 · 근거 두 줄. 근거 개수는 응답마다 달라 두 줄로 잡는다
 *
 * @param todayLabel 서버가 정한 날짜 문자열. `loading.tsx` 는 그 값을 모르므로 `null` 을
 *   넘겨 **자리만** 잡는다 — 지어낸 날짜를 세우지 않는다.
 */
export function WalkVerdictSkeleton({ todayLabel }: { todayLabel: string | null }) {
  const date =
    todayLabel === null ? (
      <CaptionLine className="w-44" />
    ) : (
      <span className="text-caption text-fg-muted block font-medium tabular-nums">
        {todayLabel}
      </span>
    )

  return (
    <div aria-busy className="border-border border-t">
      {/* 모바일 — `WalkVerdict` 의 접힌 버튼 줄과 같은 칸 */}
      <div className="px-4 py-3 md:hidden">
        {date}
        <div aria-hidden className="flex h-7 items-center">
          <Skeleton className="h-6 w-28" />
        </div>
        <CaptionLine className="w-52" />
      </div>

      {/* 데스크톱 — 펼친 패널 */}
      <div className="hidden flex-col gap-3 px-5 py-5 md:flex">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {date}
            <Skeleton className="h-7 w-28" />
          </div>
          {/* 체감온도 — 라벨 caption + hero 값 */}
          <div aria-hidden className="flex shrink-0 flex-col items-end gap-1">
            <CaptionLine className="w-16" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <CaptionLine className="w-40" />
        <div aria-hidden className="flex h-5.5 items-center">
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  )
}

/**
 * caption 한 줄(18) 자리. 막대를 줄 높이 그대로 칠하면 위아래 줄과 붙어 한 덩어리로
 * 보여서, **칸은 18 로 두고 막대만 14** 로 세운다 — 높이는 실화면과 같다.
 */
function CaptionLine({ className }: { className: string }) {
  return (
    <div aria-hidden className="flex h-4.5 items-center">
      <Skeleton className={cn('h-3.5', className)} />
    </div>
  )
}
