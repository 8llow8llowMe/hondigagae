'use client'

import { useState } from 'react'

import { BasisFootnote } from '@/components/basis-footnote'
import { ChevronDownIcon, ClockIcon } from '@/components/icons'
import { InfoTip } from '@/components/info-tip'
import { MetricValue, MetricWord } from '@/components/metric'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatCelsius } from '@/lib/format/celsius'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
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
 *
 * **아래에 밴드를 그리지 않는다** (#305). 예전에는 이 섹션이 끝에서 8px 밴드를 그렸고,
 * 접었을 때 tint 줄 아래 회색 줄만 남는 문제 때문에 그것을 `open` 에 묶어 두어야 했다.
 *
 * 밴드는 "여기서 **다른 이야기**가 시작된다" 는 유일한 신호인데(DESIGN.md §0), 바로 아래
 * 골든타임은 다른 이야기가 아니다 — "지금 나가도 되나" 다음 질문이 "그럼 언제 나가나" 이고
 * 둘은 같은 판정 규칙을 쓴다. 같은 이야기 안은 1px 선으로 잇고, 그 선은
 * `WalkTimesSection` 의 `border-t` 가 이미 그린다. 여기서 또 그리면 선이 두 겹이 된다.
 *
 * 접힘에 따라 경계의 굵기가 바뀌던 것도 함께 사라진다.
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

  /*
    **`heatIndexCelsius` 가 아니라 `feelsLikeCelsius` 다** (#292). 판정 기준이 NOAA 열지수에서
    기상청 체감온도로 바뀌었고(BE `46f35e4`), 열지수는 판정에 쓰이지 않는 참고값으로 내려갔다.
    이 줄이 옛 필드를 읽는 동안 화면은 `체감온도` 라벨로 **판정에 쓰이지 않는 숫자**를 말했다 —
    서늘한 날은 차이가 작지만 33℃/85% 에서 48 vs 35.5 로 갈린다.

    **참고 열지수를 여기 곁들이지 않는다.** 홈은 요약면이고 이 줄은 접힌 상태에서 한 줄이다.
    참고값과 그것을 참고값이라 말하는 문장은 장소 상세의 펼침 근거가 함께 맡는다.
  */
  const feelsLike = formatCelsius(data.feelsLikeCelsius)
  const summary = [
    feelsLike === null ? null : `${messages.home.feelsLikeLabel} ${feelsLike}℃`,
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
          'focus-visible:ring-brand-500 flex w-full items-center gap-2 px-4 py-3 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:hidden',
          /*
            위험만 그 줄을 tint 로 강조한다. **다섯 톤 표를 만들지 않는다** — 이 조건이
            `critical` 로 좁혀 실제로 쓰이는 값은 하나뿐이고, 표로 두면 나머지 넷도
            쓰이는 것처럼 읽힌다.
          */
          tone === 'critical' && 'bg-metric-critical-100',
        )}
      >
        <span className="min-w-0 flex-1">
          {/*
            **모바일에도 배지를 둔다.** 아래 데스크톱 등급 줄은 `md:flex` 라 모바일에서 아예
            렌더되지 않아, 여기 없으면 접힌 상태의 모바일 사용자는 특보를 못 본다 —
            이 서비스에서 가장 흔한 화면이다.
          */}
          <span className="text-body-1 flex flex-wrap items-center gap-x-1 gap-y-1 font-semibold">
            <span className="text-fg-muted">{messages.home.walkTodayLabel}</span>
            <MetricWord tone={tone}>{data.walkSafetyLevel.name}</MetricWord>
            <WeatherWarningBadge warning={data.weatherWarning} />
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
          'flex-col gap-3 pt-4 pb-4 md:flex md:py-5',
          INSET_CLASS.rail,
          open ? 'flex' : 'hidden',
        )}
      >
        {/* 데스크톱에만 보이는 등급 줄 — 모바일은 위 버튼이 이미 말했다 */}
        <div className="hidden items-end justify-between gap-3 md:flex">
          {/*
            특보 배지는 등급 줄에 함께 선다. 경보면 서버가 이미 `DANGER` 로 끊어 이 섹션이
            자동 펼침 + tint 인 상태이고, 배지는 그 이유를 말한다 — 등급을 대신하지 않는다.
          */}
          <span className="text-body-1 flex flex-wrap items-center gap-x-1 gap-y-2 font-semibold">
            <span className="text-fg-muted">{messages.home.walkTodayLabel}</span>
            <MetricWord tone={tone}>{data.walkSafetyLevel.name}</MetricWord>
            <WeatherWarningBadge warning={data.weatherWarning} />
          </span>
          {/*
            **라벨을 붙인다** (#259). 모바일 접힌 줄은 `feelsLikeLabel` 을 이미 달고 있는데
            데스크톱 hero 만 맨 숫자였다 — 같은 화면의 같은 값이 폭에 따라 이름을 잃었다.
            아래 기준 줄(`{장소} 기준`)은 어디의 값인지만 말하고 무엇인지는 말하지 않는다.
          */}
          {feelsLike !== null && (
            <MetricValue
              label={
                <span className="inline-flex items-center gap-1">
                  {messages.home.feelsLikeLabel}
                  {/*
                    **`33.0℃` 가 무슨 척도인지 말하는 자리가 홈에 없었다** (#313).
                    `feelsLikeBasis` 는 응답에 이미 있고 장소 상세는 접힘 서랍으로 내보내는데,
                    홈은 숫자만 있었다. 상시 노출로 세우지 않고 원할 때 여는 채널로 둔다 —
                    홈 첫 화면의 밀도를 키우면서 행동은 하나도 바꾸지 않는 문장이다.

                    **`null` 이면 아이콘 자체를 렌더하지 않는다.** 눌러도 빈 말풍선이 뜨는
                    물음표를 두지 않는다.
                  */}
                  {data.feelsLikeBasis !== null && (
                    <InfoTip label={messages.home.feelsLikeBasisLabel}>
                      {data.feelsLikeBasis}
                      {/*
                        출처와 계산 입력 (#317). **상시 노출 줄을 새로 만들지 않는다** —
                        홈 첫 화면의 밀도를 키우면서 행동은 하나도 바꾸지 않는 값이라,
                        근거를 여는 이 자리 안에서만 산다.
                      */}
                      <BasisFootnote
                        humidity={data.humidity}
                        providerName={data.weatherProviderName}
                        className="mt-2"
                      />
                    </InfoTip>
                  )}
                </span>
              }
              value={feelsLike}
              unit="℃"
              tone={tone}
              size="hero"
              className="shrink-0"
            />
          )}
        </div>
        <p className="text-caption text-fg-muted hidden font-medium md:block">
          {data.placeTitle} {messages.home.basisSuffix}
          {petName !== null && ` · ${petName} ${messages.home.basisSuffix}`}
        </p>

        {/*
          **등급이 권하는 행동.** `walkSafetyLevel.description` 은 "짧게 걷고 물과 그늘을
          챙기는 편이 좋습니다" 같은 완성형 문장인데, 화면은 지금까지 등급어(`주의`) 두
          글자만 쓰고 이 문장을 버리고 있었다. 이 서비스는 판정이 아니라 **판단을 돕는**
          쪽이고, 그 일을 하는 문장이 응답에 이미 들어 있었다.

          **`reasons` 위에 둔다.** 근거("왜 주의인가")보다 조치("그럼 어떻게 하나")가
          먼저 읽혀야 한다 — 근거는 그 조치를 뒷받침하는 자리다.

          **`scoreDescription` 은 쓰지 않는다.** "위험 요인이 하나 이상 확인되었습니다" 는
          아래 `reasons` 가 그 요인을 낱낱이 세는 것과 같은 말이고, 행동을 바꾸지 않는다.
        */}
        {data.walkSafetyLevel.description !== null && (
          <p className="text-body-2 text-fg">{data.walkSafetyLevel.description}</p>
        )}

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
