'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type ChipProps = {
  selected: boolean
  onSelect: () => void
  children: ReactNode
  className?: string
}

/** 필터 칩. 모바일 터치 영역 44px 를 지킨다 (DESIGN.md §7) */
export function Chip({ selected, onSelect, children, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'text-body-2 inline-flex h-11 items-center rounded-full border px-4 whitespace-nowrap transition-colors',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
          : 'border-border bg-bg text-fg-muted hover:bg-bg-subtle',
        className,
      )}
    >
      {children}
    </button>
  )
}
