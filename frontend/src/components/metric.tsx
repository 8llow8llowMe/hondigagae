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
 * `sm` · `md` 는 `Badge` 와 **같은 값**이다 (`src/components/badge.tsx`).
 *
 * 두 배지가 한 줄에 나란히 서는 곳이 있다 — 장소 행의 `동반 가능` `문화시설`(속성) 옆에
 * `실내 여부 미확인`(등급 unknown). 높이가 다르면 그 줄이 어긋나 보인다.
 *
 * **`score` 만 그 짝에서 빠진다** (#412). 이 크기는 **숫자만 담는 배지**를 위한 것이고,
 * 지금 쓰는 곳은 홈 권역 행의 `weatherScore` 하나다 — 나머지 `MetricBadge` 는 전부
 * 서버 문구(`suitabilityLevel.name` · 혼잡도 `name` · `실내 여부 미확인`)를 담는다.
 *
 * **낱말과 숫자는 같은 여백에서 다르게 보인다.** `부분 동반 가능` 을 알맞게 감싸는 8px 이
 * `100` 에서는 조여 보인다 — 글자 수가 적을수록 좌우 여백이 시각적 무게를 결정한다.
 * 그래서 12px 를 준다.
 *
 * **`score` 는 `Badge` 옆에 서지 않으므로** 짝을 깨지 않는다. 새로 쓸 곳이 생기면
 * 그 줄에 `Badge` 가 함께 오는지 먼저 본다.
 *
 * **여백을 더 키우려면 담는 칸을 함께 본다.** 권역 칸은 폭이 고정(`lg:w-46`)이라 배지가
 * 넓어지면 숫자 자리가 조용히 눌린다 — `src/styles/overlay-and-region-cell.test.ts` 가
 * 이 파일의 값을 읽어 칸 폭과 함께 검사한다.
 */
const BADGE_SIZE: Record<MetricBadgeSize, string> = {
  sm: 'h-5 px-2',
  md: 'px-2 py-1',
  score: 'px-3 py-1',
}

export type MetricBadgeSize = 'sm' | 'md' | 'score'

/**
 * 등급 배지.
 *
 * **세로 바가 없다.** 문구가 등급을 말하므로 색은 보조 채널이고, 바를 달면 목록이
 * 색 줄무늬로 읽힌다 (DESIGN.md §10).
 * **문구를 아이콘으로 대체하지 않는다.**
 */
export function MetricBadge({
  tone,
  size = 'md',
  children,
  className,
}: {
  tone: MetricTone
  /** `sm` 은 `Badge size="sm"` 과 나란히 설 때 (같은 `h-5`) */
  size?: MetricBadgeSize
  /** 서버 `name` 을 그대로 넣는다 */
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        // `border-transparent` 은 장식이 아니다 — unknown 만 테두리가 있으면 같은 목록에서
        // 그 배지만 2px 높다. 투명 테두리로 자리를 미리 잡아 톤과 무관하게 높이를 맞춘다
        'text-caption inline-flex items-center rounded-sm border border-transparent font-semibold whitespace-nowrap',
        BADGE_SIZE[size],
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * 흰 배경 위 등급 **글자**에 쓰는 색. **`-700` 층이다** (DESIGN.md §2-3 — 흰 배경 대비
 * HIGH 8.64:1 · LOW 7.56:1 · CRITICAL 6.47:1 · MID 5.64:1).
 *
 * `-500` 을 쓰지 않는다 — 그 층은 마크와 22px+/900 큰 숫자 전용이고, MID 는 흰 배경에서
 * 3.85:1 이라 단어에 쓰면 대비가 무너진다.
 *
 * **내보내는 이유는 `MetricWord` 가 크기까지 못박기 때문이다** (20/800 고정). 등급 색은
 * 필요한데 그 크기는 아닌 자리가 있다 — 홈 골든타임의 추천 시각(22/700)이 그렇다.
 * 그런 자리는 이 표를 직접 쓰되 **`-700` 층 밖으로 나가지 않는다.**
 */
export const METRIC_WORD_TONE: Record<MetricTone, string> = {
  critical: 'text-metric-critical-700',
  high: 'text-metric-high-700',
  mid: 'text-metric-mid-700',
  low: 'text-metric-low-700',
  // UNKNOWN 에는 등급 색이 없다. --metric-unknown-500 은 점선 전용이다
  unknown: 'text-fg-muted',
}

/**
 * 등급을 문장 안에서 말하는 단어 — 아트보드 `장소 상세` 01·03 "몽실이에게 **적합해요**",
 * `홈` 01·02 "오늘 산책 **위험**".
 *
 * 배지(`MetricBadge`)와 역할이 다르다. 배지는 목록에서 훑는 라벨이고, 이쪽은 **한 화면에
 * 하나뿐인 판정 문장의 술어**라 tint 없이 크기와 색으로 선다.
 *
 * 크기는 **`emphasis`(20/800) 고정**이다. 아트보드가 두 화면 모두 `font-size:20px;
 * font-weight:800` 이고, 이것을 호출부가 정하게 두면 화면마다 등급어 크기가 갈린다
 * (실제로 갈려 있었다 — 홈 20px / 장소 상세 18px).
 *
 * **문구는 서버 `name` 을 그대로 넣는다.** FE 가 등급 한국어를 다시 쓰지 않는다.
 */
export function MetricWord({
  tone,
  children,
  className,
}: {
  tone: MetricTone
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('text-emphasis font-extrabold', METRIC_WORD_TONE[tone], className)}>
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
