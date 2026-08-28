import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'danger'
export type BadgeSize = 'sm' | 'md'

export type BadgeProps = {
  tone?: BadgeTone
  size?: BadgeSize
  children: ReactNode
  className?: string
}

/**
 * tint 배경 위 12px 텍스트라 전부 4.5:1 이상을 확보해야 한다.
 * 흰 배경용 -500 을 그대로 쓰면 대비가 부족하므로 -700 계열을 쓴다 (DESIGN.md §2).
 *
 * **등급 배지는 이것이 아니라 `MetricBadge` 다** (`src/components/metric.tsx`).
 * 여기 `brand` 톤을 등급 표시로 전용하지 않는다 — DESIGN.md §2-3.
 *
 * `warn` · `info` 톤은 3차 세트에서 폐기했다 (DESIGN.md §2-7). 측정값은 경고가 아니라
 * `MetricBadge` 로 가고, 파란 정보 톤은 팔레트에 없다 — 중립(`neutral`)을 쓴다.
 */
const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-band text-fg-muted',
  brand: 'bg-metric-high-100 text-metric-high-700',
  accent: 'bg-accent-100 text-accent-700',
  danger: 'bg-danger-100 text-danger-700',
}

const SIZE: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-caption',
  md: 'h-6 px-2.5 text-caption',
}

export function Badge({ tone = 'neutral', size = 'md', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm font-medium whitespace-nowrap',
        TONE[tone],
        SIZE[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
