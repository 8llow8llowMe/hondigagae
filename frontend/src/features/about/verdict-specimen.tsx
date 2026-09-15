'use client'

import { useEffect, useRef, useState } from 'react'

import { MetricBadge } from '@/components/metric'
import { VERDICT_SPECIMEN } from '@/features/about/about-specimen-data'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

const COUNT_UP_MS = 600

/**
 * 0 → target 카운트업 (#635, 명세 §6-4). `play` 가 참이 되는 순간 시작하고 600ms 뒤 **반드시
 * 끝 값으로 고정**한다 — 브라우저 패널이 숨겨지면 rAF 가 멈춰 중간값에 머무는 함정이 있다.
 * `prefers-reduced-motion` 이면 즉시 끝 값 — JS 가 그리는 값이라 전역 CSS 규칙이 못 덮는다.
 * 처음 값은 **target 이다** (정적 렌더 = 끝 상태).
 */
function useCountUp(target: number, play: boolean): number {
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (!play) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(target * eased * 10) / 10)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    setValue(0)
    frame = requestAnimationFrame(tick)
    const settle = window.setTimeout(() => setValue(target), COUNT_UP_MS + 50)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settle)
    }
  }, [target, play])

  return value
}

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
    <div className="bg-band rounded-md px-3 py-2">
      <p className="text-caption text-fg-muted font-medium">{label}</p>
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
      <div className="flex items-start justify-between gap-3 px-4 pt-4 md:px-5">
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
      <div className="px-4 pt-3 pb-4 md:px-5">
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
