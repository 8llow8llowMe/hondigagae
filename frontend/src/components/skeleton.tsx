import { cn } from '@/lib/utils/cn'

export type SkeletonVariant = 'text' | 'card' | 'thumbnail'

export type SkeletonProps = {
  variant?: SkeletonVariant
  className?: string
}

const VARIANT: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded-sm',
  card: 'h-32 w-full rounded-lg',
  thumbnail: 'aspect-square w-full rounded-md',
}

/** 스크린리더가 의미 없는 반복을 읽지 않게 aria-hidden 을 둔다 (component-guide.md §7) */
export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return (
    <div aria-hidden className={cn('bg-bg-subtle animate-pulse', VARIANT[variant], className)} />
  )
}
