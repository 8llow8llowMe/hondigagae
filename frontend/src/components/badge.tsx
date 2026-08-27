import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'warn' | 'danger' | 'info'
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
 */
const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-bg-subtle text-fg-muted',
  brand: 'bg-brand-100 text-brand-700',
  accent: 'bg-accent-100 text-accent-700',
  warn: 'bg-warn-100 text-warn-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-info-100 text-info-700',
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
