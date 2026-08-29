import Link from 'next/link'

import { MetricValue } from '@/components/metric'
import { ReasonList } from '@/components/reason-list'
import { formatCelsius } from '@/lib/format/celsius'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { WalkSafetyResponse } from '@/types/insight'

/**
 * 오늘 산책 판정 — 홈-세부명세 D1 · 디자인 가이드 §5 ProfileCard.
 *
 * **등급어는 세로 바 없이 타입으로 구분한다** — 라벨("오늘 산책") 16/600 `--fg-muted`,
 * 등급어("위험") 20/800 + 등급 text 색 (가이드 §5).
 *
 * **판정에는 기준을 밝힌다** — "14:00 기준 · {장소명} 기준". 기준이 없으면 사용자가
 * 지금 얘기인지 오늘 얘기인지 모른다 (공통명세 S3-2).
 *
 * 값이 없는 줄은 **숨긴다.** "—" 로 채우면 0도인 것과 구분되지 않는다.
 */
export function WalkVerdictCard({
  data,
  petName,
  busy = false,
}: {
  data: WalkSafetyResponse
  /** 미로그인·반려견 없음이면 null — 일반 판정이라는 뜻이다 */
  petName: string | null
  /** 반려견 전환 중. 스켈레톤 대신 이전 값을 흐리게 유지한다 (D4-2) */
  busy?: boolean
}) {
  const tone = walkSafetyTone(data.walkSafetyLevel.code)
  const heatIndex = formatCelsius(data.heatIndexCelsius)
  const pavement = formatCelsius(data.estimatedPavementCelsius)
  const time = data.targetDateTime.slice(11, 16)

  const TONE_TEXT = {
    critical: 'text-metric-critical-700',
    high: 'text-metric-high-700',
    mid: 'text-metric-mid-700',
    low: 'text-metric-low-700',
    unknown: 'text-fg-muted',
  } as const

  return (
    <section
      aria-busy={busy || undefined}
      aria-labelledby="walk-verdict-heading"
      className={cn('bg-bg px-4 py-5 md:px-10', busy && 'opacity-55 transition-opacity')}
    >
      <h2 id="walk-verdict-heading" className="sr-only">
        {messages.home.walkTodayLabel}
      </h2>

      {/* 라벨 + 등급어. 세로 바를 쓰지 않는다 — 색과 두께로만 구분한다 (가이드 §5) */}
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-body-1 text-fg-muted font-semibold">
          {messages.home.walkTodayLabel}
        </span>
        <span className={cn('text-verdict font-extrabold', TONE_TEXT[tone])}>
          {data.walkSafetyLevel.name}
        </span>
      </p>

      {/* 기준을 밝힌다 — 시각 + 장소 + (있으면) 반려견 */}
      <p className="text-caption text-fg-muted mt-1 tabular-nums">
        {time} {messages.home.basisSuffix} · {data.placeTitle} {messages.home.basisSuffix}
        {petName !== null && ` · ${petName} ${messages.home.basisSuffix}`}
      </p>

      <div className="mt-4 flex flex-wrap gap-6">
        {heatIndex !== null && (
          <MetricValue
            label={messages.home.heatIndexLabel}
            value={heatIndex}
            unit="℃"
            tone={tone}
          />
        )}
        {pavement !== null && (
          <MetricValue label={messages.home.pavementLabel} value={pavement} unit="℃" tone={tone} />
        )}
      </div>

      {/* 없으면 줄 자체를 렌더하지 않는다 (D5-1) */}
      {data.saferWindowStart !== null && data.saferWindowEnd !== null && (
        <p className="text-body-2 text-fg mt-3 tabular-nums">
          <span className="text-fg-muted">{messages.home.saferWindowLabel}</span>{' '}
          {data.saferWindowStart.slice(0, 5)} – {data.saferWindowEnd.slice(0, 5)}
        </p>
      )}

      {/* 산책 위험도 근거에는 scoreDelta 가 없다 — 전부 본문 톤이다 */}
      <ReasonList
        className="mt-4"
        reasons={data.reasons.map((reason) => ({ description: reason.description }))}
        moreLabel={messages.home.moreReasons.replace('{n}', '%d')}
        lessLabel={messages.home.lessReasons}
      />

      <Link
        href={`/places/${data.placeId}`}
        className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 mt-4 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {messages.home.reasonsLink}
      </Link>
    </section>
  )
}
