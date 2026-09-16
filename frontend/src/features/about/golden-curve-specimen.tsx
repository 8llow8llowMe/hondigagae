'use client'

import { type CSSProperties, useRef } from 'react'

import { GOLDEN_CURVE_SPECIMEN, VERDICT_SPECIMEN } from '@/features/about/about-specimen-data'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

const DRAW_MS = 800

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
 */
export function GoldenCurveSpecimen() {
  const ref = useRef<SVGSVGElement>(null)
  const phase = useRevealOnce(ref, true)
  const drawing = phase === 'armed'
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
        <p className="text-title-2 text-fg font-semibold">{copy.curveTitle}</p>
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
              drawing
                ? 'fill-metric-high-100 opacity-0 transition-none'
                : 'fill-metric-high-100 transition-opacity duration-200 ease-out'
            }
            style={{ transitionDelay: drawing ? '0ms' : `${DRAW_MS}ms` }}
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
          <path
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
              drawing ? 'opacity-0 transition-none' : 'transition-opacity duration-150 ease-out'
            }
            style={{ transitionDelay: drawing ? '0ms' : `${DRAW_MS}ms` }}
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
        <p className="text-caption text-fg-muted mt-3 font-medium">{copy.curveNote}</p>
      </div>
    </div>
  )
}
