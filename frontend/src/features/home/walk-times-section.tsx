'use client'

import { MetricWord } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatCelsius } from '@/lib/format/celsius'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { HourlyWalkSafetyItem, WalkTimesResponse } from '@/types/insight'

/**
 * 오늘의 산책 골든타임 — `GET /insights/walk-times` (#158).
 *
 * **바로 위 산책 위험도와 답하는 질문이 다르다.** 저쪽은 "지금 나가도 되나", 이쪽은
 * "오늘 언제 나가야 하나" 다. 여름 제주에서는 낮에 어차피 못 나가고 문제는 아침이
 * 나은지 저녁이 나은지다.
 *
 * **추천이 없는 날을 지어내지 않는다.** 남은 시간이 전부 위험이거나 특보 경보가 발효
 * 중이면 서버가 구간을 주지 않는다 — "그나마 이때가 낫다" 고 말하면 사용자가 그것을
 * 허락으로 읽는다 (`GoldenWalkWindow`). 그때도 **곡선은 그대로 보여 준다**: 근거를
 * 감추면 왜 안 되는지 확인할 방법이 없다.
 */
export function WalkTimesSection({
  data,
  loading = false,
}: {
  data: WalkTimesResponse | null
  loading?: boolean
}) {
  // 조회 실패는 섹션을 통째로 숨긴다 — 홈의 최소 골격에 이 섹션은 없다 (공통명세 S4-1)
  if (data === null) return loading ? <WalkTimesSkeleton /> : null

  const hasGolden = data.goldenStart !== null && data.goldenEnd !== null

  return (
    <section aria-label={messages.home.goldenHeading} className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <h2 className="text-body-1 font-semibold">{messages.home.goldenHeading}</h2>
          <WeatherWarningBadge warning={data.weatherWarning} />
        </div>

        {hasGolden ? <GoldenWindow data={data} /> : <NoGoldenWindow />}

        <HourlyCurve hourly={data.hourly} />

        <p className="text-caption text-fg-muted font-medium">
          {messages.home.goldenBasis} · {messages.home.goldenPavementNote}
        </p>
      </div>

      <div aria-hidden className="bg-band h-2 w-full" />
    </section>
  )
}

/**
 * 추천 구간. **시각을 문장으로도 적는다** — 아래 곡선의 강조만으로 전하면 색에 기대게 되고,
 * 그것은 DESIGN.md §2-3(색만으로 정보를 전달하지 않는다)에 어긋난다.
 */
function GoldenWindow({ data }: { data: WalkTimesResponse }) {
  const tone = walkSafetyTone(data.goldenLevel?.code)

  return (
    <p className="text-body-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-semibold tabular-nums">
      <span className="text-metric-high-700 text-title-3">
        {hourMinute(data.goldenStart)} – {hourMinute(data.goldenEnd)}
      </span>
      {data.goldenLevel !== null && <MetricWord tone={tone}>{data.goldenLevel.name}</MetricWord>}
    </p>
  )
}

function NoGoldenWindow() {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body-1 text-metric-critical-700 font-semibold">
        {messages.home.goldenNone}
      </p>
      <p className="text-body-2 text-fg-muted">{messages.home.goldenNoneDesc}</p>
    </div>
  )
}

/**
 * 시간대 곡선.
 *
 * **가로 스크롤 한 줄이다.** 세로 목록으로 두면 8시간이 화면을 다 먹고, 곡선의 요점인
 * "언제부터 괜찮아지는가" 가 한눈에 안 들어온다.
 *
 * 셀마다 **시각 · 막대 · 노면온도** 셋을 함께 둔다. 막대만 두면 색이 유일한 정보가 되고,
 * 노면온도가 이 판정의 실제 근거라 그것을 숫자로 보여야 사용자가 판단을 검증할 수 있다.
 */
function HourlyCurve({ hourly }: { hourly: HourlyWalkSafetyItem[] }) {
  if (hourly.length === 0) {
    return <p className="text-body-2 text-fg-muted">{messages.home.goldenCurveEmpty}</p>
  }

  return (
    <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:-mx-6 md:px-6">
      {hourly.map((hour) => (
        <HourCell key={hour.at} hour={hour} />
      ))}
    </ul>
  )
}

/**
 * 막대 색은 등급 톤의 **-500 층**이다. 3px 지표 바와 같은 자리라 12px 텍스트 대비 규칙이
 * 걸리지 않는다 (DESIGN.md §2-3 — `-500` 은 지표 바와 stroke 아이콘 전용).
 */
const BAR_TONE: Record<string, string> = {
  critical: 'bg-metric-critical-500',
  high: 'bg-metric-high-500',
  mid: 'bg-metric-mid-500',
  low: 'bg-metric-low-500',
  unknown: 'bg-metric-unknown-500',
}

function HourCell({ hour }: { hour: HourlyWalkSafetyItem }) {
  const tone = walkSafetyTone(hour.walkSafetyLevel.code)
  const pavement = formatCelsius(hour.estimatedPavementCelsius)

  return (
    <li className="flex shrink-0 flex-col items-center gap-1.5" style={{ minWidth: '3rem' }}>
      <span className="text-caption text-fg-muted font-medium tabular-nums">
        {hourOnly(hour.at)}
      </span>
      {/*
        등급 이름을 화면에서 지우지 않는다 — 막대는 색뿐이라 스크린리더에 아무 말도 하지
        못한다. 시각적으로는 숫자가 대신하므로 이름은 보조기기 전용으로 둔다.
      */}
      <span className={cn('h-8 w-2 rounded-full', BAR_TONE[tone])}>
        <span className="sr-only">{hour.walkSafetyLevel.name}</span>
      </span>
      <span className="text-caption text-fg-muted font-medium tabular-nums">
        {pavement === null ? '—' : `${pavement}℃`}
      </span>
    </li>
  )
}

function WalkTimesSkeleton() {
  return (
    <section aria-hidden className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="bg-band h-2 w-full" />
    </section>
  )
}

/** `2026-08-29T18:00:00` → `18:00`. **서버 문자열을 그대로 자른다** — `Date` 로 파싱하면
 * 서버가 준 지역 시각이 브라우저 타임존으로 밀린다 */
function hourMinute(at: string | null): string {
  return at === null ? '' : at.slice(11, 16)
}

/** `2026-08-29T18:00:00` → `18시` */
function hourOnly(at: string): string {
  return `${at.slice(11, 13)}시`
}
