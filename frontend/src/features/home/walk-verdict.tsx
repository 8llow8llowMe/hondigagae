'use client'

import { useState } from 'react'

import { ChevronDownIcon, ClockIcon } from '@/components/icons'
import { MetricValue, MetricWord } from '@/components/metric'
import { formatCelsius } from '@/lib/format/celsius'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { WalkSafetyResponse } from '@/types/insight'

/**
 * 오늘 산책 판정 — 아트보드 `01 홈 · P1 아래` / `02 홈` 좌측 / `04 ①`.
 *
 * **프로필 바로 아래에 1px 선으로 붙인다.** 밴드로 끊거나 별도 블록으로 분리하지 않는다 —
 * 판정의 화자(누구 기준인가)가 사라진다.
 *
 * 접힘/펼침이 폭마다 다르다.
 * - **모바일**: 접힌 한 줄(등급 + 수치 + 기준 장소). 누르면 펼친다
 * - **데스크톱**: 펼친 패널이 기본
 *
 * **`위험`(DANGER)은 유일하게 접지 않는다** — 자동 펼침이고, 그 줄만 tint 로 강조한다.
 *
 * 등급어는 세로 바 없이 **라벨 16/600 `--fg-muted` + 등급어 20/800 등급 색**으로 구분한다.
 */
export function WalkVerdict({
  data,
  petName,
  busy = false,
}: {
  data: WalkSafetyResponse
  petName: string | null
  busy?: boolean
}) {
  const tone = walkSafetyTone(data.walkSafetyLevel.code)
  // 위험은 접지 않는다 — 자동 펼침 (아트보드 04-①)
  const [open, setOpen] = useState(tone === 'critical')

  const heatIndex = formatCelsius(data.heatIndexCelsius)
  const summary = [
    heatIndex === null ? null : `${messages.home.heatIndexLabel} ${heatIndex}℃`,
    `${data.placeTitle} ${messages.home.basisSuffix}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  return (
    <section
      aria-busy={busy || undefined}
      aria-label={messages.home.walkTodayLabel}
      className={cn('border-border border-t', busy && 'opacity-55')}
    >
      {/* 모바일 — 접힌 한 줄. 누르면 펼친다 */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'focus-visible:ring-brand-500 flex w-full items-center gap-2.5 px-4 py-3.5 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:hidden',
          /*
            위험만 그 줄을 tint 로 강조한다. **다섯 톤 표를 만들지 않는다** — 이 조건이
            `critical` 로 좁혀 실제로 쓰이는 값은 하나뿐이고, 표로 두면 나머지 넷도
            쓰이는 것처럼 읽힌다.
          */
          tone === 'critical' && 'bg-metric-critical-100',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="text-body-1 block font-semibold">
            <span className="text-fg-muted">{messages.home.walkTodayLabel}</span>{' '}
            <MetricWord tone={tone}>{data.walkSafetyLevel.name}</MetricWord>
          </span>
          <span className="text-caption text-fg-muted block font-medium tabular-nums">
            {summary}
          </span>
        </span>
        <ChevronDownIcon
          size={20}
          className={cn('text-fg-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {/*
        데스크톱 — 펼친 패널이 기본. 모바일은 접힘 상태에 따른다.

        **모바일 `pt-4` 를 준다.** 없으면 위 버튼(위험이면 tint 면)에 첫 문장이 붙어
        같은 덩어리로 읽힌다. 데스크톱은 `md:py-5` 가 위아래를 함께 잡는다.
      */}
      <div
        className={cn(
          'flex-col gap-3 px-4 pt-4 pb-4 md:flex md:px-6 md:py-5',
          open ? 'flex' : 'hidden',
        )}
      >
        {/* 데스크톱에만 보이는 등급 줄 — 모바일은 위 버튼이 이미 말했다 */}
        <div className="hidden items-end justify-between gap-3 md:flex">
          <span className="text-body-1 font-semibold">
            <span className="text-fg-muted">{messages.home.walkTodayLabel}</span>{' '}
            <MetricWord tone={tone}>{data.walkSafetyLevel.name}</MetricWord>
          </span>
          {heatIndex !== null && (
            <MetricValue value={heatIndex} unit="℃" tone={tone} size="hero" className="shrink-0" />
          )}
        </div>
        <p className="text-caption text-fg-muted hidden font-medium md:block">
          {data.placeTitle} {messages.home.basisSuffix}
          {petName !== null && ` · ${petName} ${messages.home.basisSuffix}`}
        </p>

        <VerdictReasons reasons={data.reasons} />

        {/* 안전 시간대는 조언의 실체다. 없으면 줄 자체를 렌더하지 않는다 */}
        {data.saferWindowStart !== null && data.saferWindowEnd !== null && (
          <p className="bg-metric-high-100 text-metric-high-700 text-body-2 flex items-center gap-2 rounded-md p-3 tabular-nums">
            <ClockIcon size={20} className="shrink-0" />
            {messages.home.saferWindowLabel}는 {data.saferWindowStart.slice(0, 5)} –{' '}
            {data.saferWindowEnd.slice(0, 5)}
          </p>
        )}
      </div>

      {/*
        **아래 묶음과의 경계선을 이 섹션이 그린다** (DESIGN.md §0 의 8px 밴드).
        호출부에 두면 접었을 때 tint 줄 아래에 회색 줄만 남아, 접힌 판정이 아니라
        빈 밴드가 하나 떠 있는 것처럼 보인다. 접힘과 함께 사라져야 하는 경계다.
      */}
      <div aria-hidden className={cn('bg-band h-2 w-full md:block', open ? 'block' : 'hidden')} />
    </section>
  )
}

/** 기본 2개 + 펼침. 서버 순서를 재정렬하지 않는다 */
function VerdictReasons({ reasons }: { reasons: { description: string }[] }) {
  const [expanded, setExpanded] = useState(false)

  if (reasons.length === 0) return null

  const visible = expanded ? reasons : reasons.slice(0, 2)
  const hidden = reasons.length - visible.length

  return (
    <div className="flex flex-col gap-2">
      {visible.map((reason, index) => (
        <p key={`${index}-${reason.description}`} className="text-body-2 text-fg">
          {reason.description}
        </p>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(true)}
          className="text-body-2 text-link focus-visible:ring-brand-500 flex min-h-11 items-center gap-1 self-start font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.home.moreReasons.replace('{n}', String(hidden))}
          <ChevronDownIcon size={16} />
        </button>
      )}
    </div>
  )
}
