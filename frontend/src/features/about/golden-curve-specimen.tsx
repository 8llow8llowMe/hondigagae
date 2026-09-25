'use client'

import { type CSSProperties, useId, useRef, useState } from 'react'

import { MetricBadge } from '@/components/metric'
import {
  GOLDEN_CURVE_HOURLY,
  GOLDEN_CURVE_SPECIMEN,
  HOURLY_GRADE_EDGES,
  VERDICT_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { useStageStep } from '@/features/about/scroll-stage'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

const DRAW_MS = 800

/** 가로축 — x 12 가 00시이고 시간당 15px (`GOLDEN_CURVE_SPECIMEN` 주석과 같다) */
const hourX = (hour: number) => 12 + hour * 15

export type HourlyGradeCode = 'SAFE' | 'CAUTION' | 'DANGER'

/**
 * 24점 표 → 서버 판정 code (#916). 경계는 서버 기본값과 같다(`HOURLY_GRADE_EDGES` — 42 이상
 * 주의, 52 이상 위험). 낱말은 `messages.about.specimen.walkGrades[code]`, 톤은
 * `walkSafetyTone(code)` — 실화면과 같은 표를 쓴다.
 */
export function hourlyGrade(pavement: number): HourlyGradeCode {
  if (pavement >= HOURLY_GRADE_EDGES.danger) return 'DANGER'
  if (pavement >= HOURLY_GRADE_EDGES.caution) return 'CAUTION'
  return 'SAFE'
}

/** 핸들이 가리키는 시각의 읽기 문장 — 화면 줄과 `aria-valuetext` 가 같이 쓴다 */
function hourlyText(hour: number): string {
  const point = GOLDEN_CURVE_HOURLY[hour] ?? GOLDEN_CURVE_HOURLY[12]
  return messages.about.specimen.curveReadout
    .replace('{time}', `${String(hour).padStart(2, '0')}:00`)
    .replace('{temperature}', String(point.temperature))
    .replace('{pavement}', point.pavement.toFixed(1))
}

/**
 * 노면 path 위에서 x 에 해당하는 y — 길이를 반으로 가르며 찾는다. `getPointAtLength` 는
 * `pathLength` 속성과 무관한 사용자 단위라, 같은 단위인 `getTotalLength` 와 짝을 맞춘다.
 */
function yOnPath(path: SVGPathElement, x: number): number {
  let low = 0
  let high = path.getTotalLength()
  for (let i = 0; i < 24; i += 1) {
    const middle = (low + high) / 2
    if (path.getPointAtLength(middle).x < x) low = middle
    else high = middle
  }
  return path.getPointAtLength(low).y
}

/**
 * 골든타임 곡선 예시 (#635, 명세 §5-3 · §6-4).
 *
 * 선은 `pathLength=1` 위에서 `stroke-dashoffset` 1 → 0 으로 그려진다. **정적 렌더는 0(다
 * 그려짐)** 이고 `armed` 일 때만 1 이다 — JS 없이도 곡선이 보인다. 추천 구간 면은 선이 끝난
 * 뒤(800ms) 200ms 로 나타난다.
 *
 * `armed` 동안에는 transition 을 끈다 — `useRevealOnce` 의 소비자 계약이다. 이미 다 그려진
 * 선에 전환이 켜진 채로 시작 상태(dashoffset 1)를 붙이면, 그 붙임 자체가 800ms 짜리 "지우기"
 * 로 전환돼 정작 `revealed` 에서 볼 재생이 남지 않는다. 꺼 두면 시작 프레임이 즉시 칠해지고
 * 다음 프레임에 전환이 켜지며 그리기가 재생된다. 본보기는 `reveal.tsx`.
 *
 * SVG 속성 전환은 Tailwind 유틸리티가 없어 인라인 `style` 로 건다. 색은 유틸리티
 * (`stroke-*` · `fill-*`)다 — 노면 선만 `metric-critical-500`, 기온은 `fg-muted`, 추천 구간
 * 면은 `metric-high-100`(글자를 얹지 않는 tint 층).
 *
 * **면이 한 색인 것은 이 견본이 창 안 전부 한 등급인 날이기 때문이다** (#656). 실제 홈 곡선은
 * 추천 구간 안을 **시각별 등급**으로 칠한다 — 창 안이 전부 `SAFE` 인 날은 그 결과가 정확히 이
 * 모양이라 견본은 실제와 어긋나지 않는다. 다만 **범례가 어긋날 뻔했다**: `추천 구간` 한 낱말
 * 이면 초록 견본이 "초록 = 추천 구간" 을 가르치고, 그렇게 배운 사람은 실제 창 안의 황갈색 칸을
 * 추천에서 빠진 시각으로 읽는다. 범례 문구가 색의 뜻을 함께 적는다 (`curveLegendWindow`).
 *
 * **견본을 혼합 등급으로 바꾸지 않았다.** 일러스트가 말하려는 것은 "낮에 걷기 좋은 시간대가
 * 있다" 하나고(세부명세 §5-3), 여기에 등급 분포까지 담으면 그 한 문장이 묻힌다.
 *
 * **y 축에 눈금을 두지 않는다.** 곡선은 손으로 그린 그림이지 실측 플롯이 아니라, 눈금을 달면
 * 봉우리의 픽셀 높이가 곧 온도로 읽혀 카드가 말하는 값(29℃ · 56.0℃)과 어긋난다. 값은 봉우리
 * 라벨 하나로만 말하고, 가로선 3개는 눈금이 아니라 바탕 질감이다.
 *
 * **`viewBox` 배율이 타입 스케일을 우회한다.** `w-full` 만 두면 md 이상에서 폭이 2배 가까이
 * 늘며 12px 글자가 24px, 2.5px 선이 5px 로 같이 커진다. `max-w-md` 로 렌더 폭을 묶고, 선은
 * `vectorEffect="non-scaling-stroke"` 로 배율과 무관하게 지정한 굵기를 유지한다.
 *
 * **두 경로로 그린다** (#914, 명세 2026-09-25 §3-2).
 *
 * - 스크롤 무대 안(`useStageStep()` 이 값을 줌): 단계 1 에 선이 그려지고, 단계 2 에 봉우리
 *   라벨과 판정 배지, 단계 3 에 추천 구간 면, 단계 4 에 기상특보 띠가 선다. 단계를 되돌리면
 *   되돌아간다. 선 그리기는 단계 0 → 1 로 들어갈 때마다 다시 재생된다(`armed` 계약 그대로 —
 *   단계 0 동안 transition 을 끈다).
 * - 무대 밖(`null`): 지금까지처럼 화면에 들어올 때 한 번 스스로 재생한다.
 *
 * 어느 경로든 **정적 렌더는 전부 보인다** — 무대의 첫 렌더 단계는 마지막 단계다.
 *
 * **판정 배지는 단계 2 에서 처음 나타나고 그 뒤로 색이 바뀌지 않는다.** 단계 0 · 1 에서는
 * 자리를 투명하게 비운다 — 다른 등급 색을 거치지 않는다(선행 명세 §6-4 "등급 색은 끝에서만").
 */
export function GoldenCurveSpecimen() {
  const ref = useRef<SVGSVGElement>(null)
  const pavementRef = useRef<SVGPathElement>(null)
  const scrubId = useId()
  /** 시각 핸들 — 만지기 전(`null`)에는 점 · 읽기 줄을 그리지 않는다 (#916) */
  const [scrub, setScrub] = useState<{ hour: number; y: number } | null>(null)
  const phase = useRevealOnce(ref, true)
  const stage = useStageStep()
  const drawing = stage === null ? phase === 'armed' : stage.step < 1
  /** 봉우리 · 배지 · 추천 구간 · 특보가 숨는 조건. 무대 밖에서는 선이 다 그려진 뒤에 뜬다 */
  const hiddenUntil = (step: number) => (stage === null ? drawing : stage.step < step)
  /** 무대 밖에서만 선 그리기 뒤로 미룬다 — 무대 안에서는 단계가 곧 순서다 */
  const afterDraw = (extraMs = 0) => ({
    transitionDelay: drawing || stage !== null ? '0ms' : `${DRAW_MS + extraMs}ms`,
  })
  const copy = messages.about.specimen
  const data = GOLDEN_CURVE_SPECIMEN

  const lineStyle: CSSProperties = {
    strokeDasharray: 1,
    strokeDashoffset: drawing ? 1 : 0,
    transition: drawing ? 'none' : `stroke-dashoffset ${DRAW_MS}ms ease-out`,
  }

  return (
    <div className="bg-bg border-border -mx-4 border-y md:mx-0 md:rounded-lg md:border">
      <div className={cn('pt-4', INSET_CLASS.card)}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-title-2 text-fg font-semibold">{copy.curveTitle}</p>
          <span
            className={cn(
              'shrink-0',
              hiddenUntil(2)
                ? 'opacity-0 transition-none'
                : 'transition-opacity duration-150 ease-out',
            )}
            style={afterDraw()}
          >
            <MetricBadge tone="critical" axis="walkSafety">
              {copy.verdictGrade}
            </MetricBadge>
          </span>
        </div>
        <p className="text-caption text-fg-muted mt-1 font-medium">
          {copy.curveSub.replace('{window}', VERDICT_SPECIMEN.window)}
        </p>
      </div>
      <div className={cn('pt-3 pb-4', INSET_CLASS.card)}>
        <svg
          ref={ref}
          viewBox="0 0 360 150"
          className="mx-auto block h-auto w-full max-w-md"
          role="img"
          aria-label={copy.curveAria}
        >
          <rect
            x={data.windowX}
            y={8}
            width={data.windowWidth}
            height={118}
            rx={4}
            className={
              hiddenUntil(3)
                ? 'fill-metric-high-100 opacity-0 transition-none'
                : 'fill-metric-high-100 transition-opacity duration-200 ease-out'
            }
            style={afterDraw()}
          />
          {/* stroke-width 는 상속되지만 vector-effect 는 상속되지 않아 선마다 붙인다 */}
          <g className="stroke-border" strokeWidth={1}>
            <line x1={12} y1={126} x2={348} y2={126} vectorEffect="non-scaling-stroke" />
            <line
              x1={12}
              y1={86}
              x2={348}
              y2={86}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={12}
              y1={46}
              x2={348}
              y2={46}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g className="fill-fg-muted text-caption font-medium">
            {data.hours.map((hour) => (
              <text key={hour.label} x={hour.x} y={143}>
                {hour.label}
              </text>
            ))}
          </g>
          <path
            d={data.temperaturePath}
            pathLength={1}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-fg-muted"
            style={lineStyle}
          />
          {/* 무대 단계 0 에서는 선이 아직 없다 — 선 위에 서는 점도 그리지 않는다 */}
          {scrub !== null && !drawing && (
            <g aria-hidden>
              <line
                x1={hourX(scrub.hour)}
                y1={8}
                x2={hourX(scrub.hour)}
                y2={126}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                className="stroke-border-strong"
              />
              <circle
                cx={hourX(scrub.hour)}
                cy={scrub.y}
                r={5}
                strokeWidth={2}
                className="fill-metric-critical-500 stroke-bg"
              />
            </g>
          )}
          <path
            ref={pavementRef}
            d={data.pavementPath}
            pathLength={1}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-metric-critical-500"
            style={lineStyle}
          />
          <g
            className={
              hiddenUntil(2)
                ? 'opacity-0 transition-none'
                : 'transition-opacity duration-150 ease-out'
            }
            style={afterDraw()}
          >
            <circle cx={data.peak.x} cy={data.peak.y} r={4} className="fill-metric-critical-500" />
            <text
              x={data.peak.x + 8}
              y={data.peak.y - 2}
              className="fill-metric-critical-700 text-caption font-bold"
            >
              {data.peak.label}
            </text>
          </g>
        </svg>
        {/*
          시각 핸들 (#916, 명세 2026-09-25 §5). 값은 24점 예시 표이고 계산식이 없다. 만지기
          전에는 읽기 줄을 비워 둔다 — 카드 제목 옆 배지가 이미 위험을 말한다(같은 사실을 두 번
          말하지 않는다).

          **읽기는 `aria-valuetext` 하나로 한다** (#916 검토). 포커스된 range 는 값이 바뀔 때마다
          스크린리더가 스스로 값을 읽으므로, 읽기 줄에 `aria-live` 를 더하면 두 번 읽히고 드래그하면
          시각 수만큼 쌓인다. 화면 줄은 눈 몫이라 `aria-hidden` 이다.
        */}
        <label htmlFor={scrubId} className="text-caption text-fg-muted mt-3 block font-medium">
          {copy.curveScrubLabel}
        </label>
        <input
          id={scrubId}
          type="range"
          min={0}
          max={GOLDEN_CURVE_HOURLY.length - 1}
          step={1}
          defaultValue={12}
          aria-valuetext={hourlyText(scrub?.hour ?? 12)}
          onChange={(event) => {
            const hour = Number(event.currentTarget.value)
            const path = pavementRef.current
            setScrub({ hour, y: path === null ? data.peak.y : yOnPath(path, hourX(hour)) })
          }}
          className="accent-brand-600 mx-auto block h-11 w-full max-w-md"
        />
        <p aria-hidden className="text-body-2 text-fg flex min-h-6 items-center gap-2">
          {scrub !== null && <HourlyReadout hour={scrub.hour} />}
        </p>
        <ul className="text-caption text-fg-muted mt-2 flex flex-wrap gap-x-4 gap-y-1.5 font-medium">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-fg-muted inline-block h-1 w-3 rounded-sm" />
            {copy.curveLegendTemperature}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-metric-critical-500 inline-block h-1 w-3 rounded-sm" />
            {copy.curveLegendPavement}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-metric-high-100 inline-block h-3 w-4 rounded-sm" />
            {copy.curveLegendWindow}
          </li>
        </ul>
        {/* 기상특보 띠 — 특보는 판정과 같은 축의 데이터라 등급 색 자리다 (#914) */}
        <p
          className={cn(
            'bg-metric-mid-100 text-metric-mid-700 text-caption mt-3 rounded-md px-3 py-2 font-semibold',
            hiddenUntil(4)
              ? 'opacity-0 transition-none'
              : 'transition-opacity duration-200 ease-out',
          )}
          style={afterDraw(200)}
        >
          {copy.curveAlert}
        </p>
        <p className="text-caption text-fg-muted mt-3 font-medium">{copy.curveNote}</p>
      </div>
    </div>
  )
}

/** 핸들이 가리키는 시각의 읽기 줄(눈 몫) — 기온 · 노면 · 등급 배지 */
function HourlyReadout({ hour }: { hour: number }) {
  const point = GOLDEN_CURVE_HOURLY[hour] ?? GOLDEN_CURVE_HOURLY[12]
  const code = hourlyGrade(point.pavement)

  return (
    <>
      <span className="tabular-nums">{hourlyText(hour)}</span>
      <MetricBadge tone={walkSafetyTone(code)} axis="walkSafety">
        {messages.about.specimen.walkGrades[code]}
      </MetricBadge>
    </>
  )
}
