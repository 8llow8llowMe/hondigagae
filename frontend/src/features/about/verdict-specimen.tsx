'use client'

import { useRef } from 'react'

import { MetricBadge } from '@/components/metric'
import { VERDICT_SPECIMEN } from '@/features/about/about-specimen-data'
import { useCountUp } from '@/features/about/use-count-up'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

function Metric({
  label,
  value,
  final,
  decimals,
  hot = false,
}: {
  label: string
  value: number
  final: number
  decimals: 0 | 1
  hot?: boolean
}) {
  return (
    <div className="bg-band rounded-md px-2 py-2 xl:px-3">
      {/* 한 줄 (#940) — 세 칸 중 한 칸(1024 에서 안쪽 80px)에 서도록 라벨을 줄이고 1280 전까지 여백을 8 로 둔다 */}
      <p className="text-caption text-fg-muted font-medium whitespace-nowrap">{label}</p>
      <p className="text-title-1 text-fg mt-1 font-black tabular-nums">
        {/* 스크린리더는 최종값만 — 카운트업 중간값은 시각 노드에만 */}
        <span className="sr-only">{final.toFixed(decimals)}℃</span>
        <span aria-hidden className={cn(hot && 'text-metric-critical-500')}>
          {value.toFixed(decimals)}
        </span>
        <span aria-hidden className="text-caption text-fg-muted ml-1 font-medium">
          ℃
        </span>
      </p>
    </div>
  )
}

/**
 * 히어로 판정 카드 예시 (#635, 명세 §5-1 · §6-4).
 *
 * 히어로는 로드 시 보이므로 `playIfVisible` 로 **마운트 직후** 재생한다. 배지는 숫자와
 * **독립적으로** `revealed` 에서 150ms 페이드인한다 — 숫자 완료(600ms)를 기다리지 않으므로
 * `COUNT_UP_MS` 를 바꿔도 배지 타이밍은 그대로다. 배지는 `opacity` 전환이라 전역
 * reduced-motion 규칙이 덮는다. **배지는 다른 등급을 거치지 않는다** — `위험` 하나가
 * 나타날 뿐이다.
 *
 * 배지 클래스가 삼항인 것은 `useRevealOnce` 의 소비자 계약이다 — `armed` 동안 전환을 꺼야
 * 숨김 프레임이 즉시 칠해진다. `transition-*` 와 `transition-none` 은 tailwind-merge 에서
 * 같은 그룹이라 두 값을 함께 넘기면 뒤엣것만 남는다.
 */
export function VerdictSpecimen() {
  const ref = useRef<HTMLDivElement>(null)
  const phase = useRevealOnce(ref, true)
  const play = phase === 'revealed'

  const {
    temperature,
    pavement,
    feelsLike,
    pavementThreshold,
    window: saferWindow,
  } = VERDICT_SPECIMEN
  const t = useCountUp(temperature, play)
  const p = useCountUp(pavement, play)
  const f = useCountUp(feelsLike, play)
  const copy = messages.about.specimen

  return (
    <div
      ref={ref}
      role="group"
      aria-label={copy.verdictAria}
      className="bg-bg border-border -mx-4 border-y md:mx-0 md:rounded-lg md:border"
    >
      <div className={cn('flex items-start justify-between gap-3 pt-4', INSET_CLASS.card)}>
        <div>
          <p className="text-caption text-fg-muted font-semibold">{copy.verdictLabel}</p>
          <p className="text-title-2 text-fg mt-1 font-semibold">{copy.verdictTitle}</p>
        </div>
        <MetricBadge
          tone="critical"
          className={
            phase === 'armed'
              ? 'opacity-0 transition-none'
              : 'transition-opacity duration-150 ease-out'
          }
        >
          {copy.verdictGrade}
        </MetricBadge>
      </div>
      <div className={cn('pt-3 pb-4', INSET_CLASS.card)}>
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          <Metric label={copy.temperatureLabel} value={t} final={temperature} decimals={0} />
          <Metric label={copy.pavementLabel} value={p} final={pavement} decimals={1} hot />
          <Metric label={copy.feelsLikeLabel} value={f} final={feelsLike} decimals={0} />
        </div>
        <ul className="border-border mt-4 grid gap-2 border-t pt-3">
          <li className="text-body-2 text-fg flex gap-2">
            <span aria-hidden className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full" />
            {copy.reasonPavement.replace('{threshold}', String(pavementThreshold))}
          </li>
          <li className="text-body-2 text-fg flex gap-2">
            <span aria-hidden className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full" />
            {copy.reasonWindow.replace('{window}', saferWindow)}
          </li>
        </ul>
        <p className="text-caption text-fg-muted mt-3 font-medium">{copy.verdictNote}</p>
      </div>
    </div>
  )
}
