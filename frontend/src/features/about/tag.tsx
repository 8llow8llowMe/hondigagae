import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type AboutTagTone = 'neutral' | 'open' | 'unknown'

/**
 * 예시 행의 작은 태그 (#635). 세 톤이 **같은 높이(22)** 여야 한 줄에서 들쭉날쭉하지 않는다.
 *
 * `unknown` 은 채움 없이 점선 테두리다 — DESIGN.md §2-3 이 "정보 없음에는 tint 를 주지
 * 않는다" 로 정해 둔 모양이고, 홈·장소 목록의 실제 unknown 배지와 같다.
 */
const TONE: Record<AboutTagTone, string> = {
  neutral: 'bg-band text-fg-muted font-medium',
  open: 'bg-status-open-100 text-status-open-700 font-semibold',
  unknown: 'border-metric-unknown-500 text-fg-muted border border-dashed font-medium',
}

/**
 * 소개 페이지 예시 전용 태그 — **`components/` 로 올리지 않는다.**
 *
 * 이것은 실제 배지가 아니라 **예시 화면의 그림**이다. 공용으로 올리면 진짜 상태 배지
 * (`Badge` · `MetricBadge`)와 쓰임이 섞이고, 그때 고정 예시의 모양이 실제 화면 계약을
 * 끌고 다니게 된다. 쓰는 곳이 `places-specimen` · `emergency-specimen` 둘뿐이라
 * `features/about` 안에 둔다.
 */
export function Tag({ tone, children }: { tone: AboutTagTone; children: ReactNode }) {
  return (
    <span className={cn('text-caption inline-flex h-5.5 items-center rounded-sm px-2', TONE[tone])}>
      {children}
    </span>
  )
}
