import { cn } from '@/lib/utils/cn'

export type SkeletonVariant = 'text' | 'card' | 'thumbnail'

/**
 * 골격이 앉는 면. **`band` 는 `--band` 채움 카드 안**이다 — 거기서 기본 골격(`--band`)은 면과 같은
 * 색이라 사라진다(#1230 사용자 지적 "빈칸으로 보인다"). 그 갈래만 `--bg` 로 대비를 되찾는다.
 * 호출부가 `className` 으로 색을 덮지 않게 갈래로 둔다 (component-guide.md §3, #1233).
 */
export type SkeletonSurface = 'default' | 'band'

export type SkeletonProps = {
  variant?: SkeletonVariant
  surface?: SkeletonSurface
  className?: string
}

const VARIANT: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded-sm',
  card: 'h-32 w-full',
  thumbnail: 'aspect-square w-full rounded-md',
}

/** 스크린리더가 의미 없는 반복을 읽지 않게 aria-hidden 을 둔다 (component-guide.md §7) */
export function Skeleton({ variant = 'text', surface = 'default', className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        surface === 'band' ? 'bg-bg' : 'bg-band',
        'animate-pulse',
        VARIANT[variant],
        className,
      )}
    />
  )
}
