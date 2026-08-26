import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type CardVariant = 'default' | 'interactive'

export type CardProps = {
  variant?: CardVariant
  children: ReactNode
  className?: string
}

const VARIANT: Record<CardVariant, string> = {
  default: '',
  interactive: 'transition-shadow hover:shadow-md',
}

export function Card({ variant = 'default', children, className }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-elevated border-border rounded-lg border shadow-sm',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </div>
  )
}
