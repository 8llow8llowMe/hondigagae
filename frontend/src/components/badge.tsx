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

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-bg-subtle text-fg-muted',
  brand: 'bg-brand-100 text-brand-700',
  accent: 'bg-accent-100 text-accent-600',
  warn: 'bg-warn-100 text-warn-500',
  danger: 'bg-danger-100 text-danger-500',
  info: 'bg-bg-subtle text-info-500',
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
