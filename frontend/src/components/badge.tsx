import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'danger' | 'status-open' | 'status-closed'
export type BadgeSize = 'sm' | 'md'

export type BadgeProps = {
  tone?: BadgeTone
  size?: BadgeSize
  /**
   * 글자 무게를 `semibold` 로 올린다.
   *
   * **`className="font-semibold"` 대신 이것을 쓴다** — `component-guide.md` §3 이
   * `font-*` 를 호출부가 덮지 못하게 막아 둔 자리다. prop 으로 여는 이유는 무게가
   * **장식이 아니라 두 번째 채널**이기 때문이다: 영업 상태 두 톤의 tint 는 명도 대비가
   * 1.02:1 이라 적록색약에게는 색상만 다르고 밝기가 같다 (DESIGN.md §2-9 · #598).
   */
  strong?: boolean
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
 * **반대 방향도 막는다** (#598): 등급 토큰(`metric-*`)이나 장애 토큰(`danger`)을 다른
 * 뜻으로 빌려 쓰지 않는다. 병원·약국의 `진료중` / `영업 종료` 는 값이 각각 그 둘과 같아도
 * `status-open` · `status-closed` 라는 **자기 톤**을 쓴다 — 값이 아니라 뜻을 가르는 것이
 * 토큰의 일이다 (DESIGN.md §2-9).
 *
 * `warn` · `info` 톤은 3차 세트에서 폐기했다 (DESIGN.md §2-7). 측정값은 경고가 아니라
 * `MetricBadge` 로 가고, 파란 정보 톤은 팔레트에 없다 — 중립(`neutral`)을 쓴다.
 */
const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-band text-fg-muted',
  brand: 'bg-metric-high-100 text-metric-high-700',
  accent: 'bg-accent-100 text-accent-700',
  danger: 'bg-danger-100 text-danger-700',
  'status-open': 'bg-status-open-100 text-status-open-700',
  'status-closed': 'bg-status-closed-100 text-status-closed-700',
}

/**
 * 크기는 `MetricBadge` 와 **같은 값이어야 한다** (`src/components/metric.tsx`).
 * 두 배지가 한 줄에 나란히 서는 곳이 있어 값이 갈리면 그 줄이 어긋나 보인다.
 *
 * `md` 는 아트보드 값이다 — 8종 전부 `font-size:12px; line-height:18px; padding:4px 8px`
 * 하나만 쓴다. 예전 `h-6 px-2.5`(24px)는 아트보드에 없는 값이었다.
 * `MetricBadge` 가 unknown 점선을 위해 `border` 를 갖고 있어 실제 높이는 26+2 = 28 이다.
 */
const SIZE: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-caption',
  md: 'px-2 py-1 text-caption',
}

export function Badge({
  tone = 'neutral',
  size = 'md',
  strong = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm whitespace-nowrap',
        strong ? 'font-semibold' : 'font-medium',
        TONE[tone],
        SIZE[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
