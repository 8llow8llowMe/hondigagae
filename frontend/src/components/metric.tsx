import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 등급 표시 — DESIGN.md §2-3.
 *
 * **FE 는 색만 매핑하고 문구는 서버 값(`name`)을 쓴다.** 한국어 매핑 테이블을 만들지
 * 않는다 (api-integration-guide.md §6).
 *
 * **code → tone 매핑을 여기 두지 않는다.** 축마다 코드 체계가 다르고 의미가 뒤집히기
 * 때문이다 — 혼잡도의 `LOW` 는 "한산"(좋음)이고 적합도의 `LOW` 는 "주의 필요"(나쁨)다.
 * 공용 매퍼 하나를 쓰면 "혼잡" 이 초록으로 나간다. 축별 매퍼는
 * `src/lib/insight/tone.ts` 에 있고, **호출부가 톤을 계산해 넘긴다**.
 */

export type MetricTone = 'critical' | 'high' | 'mid' | 'low' | 'unknown'

/**
 * tint 배경 + `-700` 텍스트. `-500` 을 텍스트에 쓰면 대비가 무너진다.
 * unknown 에는 tint 를 주지 않는다 — 점선 테두리만이다 (DESIGN.md §2-3).
 */
const BADGE_TONE: Record<MetricTone, string> = {
  critical: 'bg-metric-critical-100 text-metric-critical-700',
  high: 'bg-metric-high-100 text-metric-high-700',
  mid: 'bg-metric-mid-100 text-metric-mid-700',
  low: 'bg-metric-low-100 text-metric-low-700',
  unknown: 'border border-dashed border-border-strong text-fg-muted',
}

/**
 * 등급 배지.
 *
 * **세로 바가 없다.** 문구가 등급을 말하므로 색은 보조 채널이고, 바를 달면 목록이
 * 색 줄무늬로 읽힌다 (DESIGN.md §10).
 * **문구를 아이콘으로 대체하지 않는다.**
 */
export function MetricBadge({
  tone,
  children,
  className,
}: {
  tone: MetricTone
  /** 서버 `name` 을 그대로 넣는다 */
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center rounded-sm px-2 py-1 font-semibold whitespace-nowrap',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** 큰 숫자에 쓰는 등급 색. 22px 이상 + weight 900 에만 허용된다 (DESIGN.md §2-3). */
const VALUE_TONE: Record<MetricTone, string> = {
  critical: 'text-metric-critical-500',
  high: 'text-metric-high-500',
  mid: 'text-metric-mid-500',
  low: 'text-metric-low-500',
  unknown: 'text-fg-muted',
}

/**
 * 지표 값 — 라벨 + 숫자 + 단위.
 *
 * - 숫자에 `tabular-nums` 를 강제한다. 목록에서 자릿수가 흔들리면 값을 비교할 수 없다.
 * - **단위를 생략하지 않는다.** 값보다 작고 흐리게(`caption` + `--fg-muted`) 붙인다.
 * - `tone` 을 주지 않으면 중립(`--fg`)이다. **거리·개수 같은 중립 수치에 등급 색을
 *   쓰지 않는다** (DESIGN.md §2-3).
 * - 크기는 `display`(28/900, 큰 지표)와 `title-1`(22/900, 행 안 점수) 둘뿐이다.
 *   **그 사이 크기를 쓰지 않는다** (DESIGN.md §3-3).
 */
export function MetricValue({
  label,
  value,
  unit,
  tone,
  size = 'row',
  className,
}: {
  /** 없으면 라벨 줄을 렌더하지 않는다 */
  label?: ReactNode
  value: ReactNode
  /** ℃ / km / % / 점 — 항상 표기한다 */
  unit?: ReactNode
  /** 생략하면 중립. 등급을 말하는 값에만 준다 */
  tone?: MetricTone
  /** `hero` 28/900 · `row` 22/900 */
  size?: 'hero' | 'row'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label !== undefined && (
        <span className="text-caption text-fg-muted font-medium">{label}</span>
      )}
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-black tabular-nums',
            size === 'hero' ? 'text-display' : 'text-title-1',
            tone === undefined ? 'text-fg' : VALUE_TONE[tone],
          )}
        >
          {value}
        </span>
        {unit !== undefined && (
          <span className="text-caption text-fg-muted font-medium">{unit}</span>
        )}
      </span>
    </div>
  )
}
