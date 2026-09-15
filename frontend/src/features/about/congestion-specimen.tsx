'use client'

import { useRef } from 'react'

import { CONGESTION_SPECIMEN } from '@/features/about/about-specimen-data'
import { useRevealOnce } from '@/features/about/use-reveal-once'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

const GROW_MS = 400
const STAGGER_MS = 60

/**
 * 한산한 날 막대 예시 (#635, 명세 §5-4 b · §6-4).
 *
 * 막대는 `--congestion-bar`, 고른 날만 `--congestion-best` — 등급 스케일이 아니다(§2-3 #603,
 * 붐비는 날은 위험한 날이 아니라 사람 많은 날). 높이는 고정 %, `armed` 일 때 `scale-y-0`
 * 에서 자라나고 형제 60ms 지연. **고른 날의 진한 색은 마지막에** 붙는다 — 색 전환 지연을
 * 막대 전부가 끝난 뒤(7×60 + 400)로 둔다.
 *
 * `armed` 동안에는 transition 을 끄고 시작 상태(`scale-y-0` · 옅은 막대색)만 붙인다 —
 * `useRevealOnce` 의 소비자 계약이다. 이미 자라 있는 막대에 전환이 켜진 채로 `scale-y-0` 를
 * 붙이면 그 붙임 자체가 400ms 짜리 "접기" 로 전환돼 정작 `revealed` 에서 볼 재생이 남지
 * 않는다. 본보기는 `reveal.tsx` · `golden-curve-specimen.tsx`.
 *
 * 그래서 색도 위상으로 갈린다 — `armed` 는 전부 `bg-congestion-bar` 이고 고른 날의
 * `bg-congestion-best` 는 `revealed` 에서만 붙는다. 정적 렌더(`idle`)는 **끝 상태**라
 * JS 없이도 고른 날이 진하게 보인다.
 */
export function CongestionSpecimen() {
  const ref = useRef<HTMLDivElement>(null)
  const phase = useRevealOnce(ref, true)
  const armed = phase === 'armed'
  const { heights, labels, bestIndex, bestDate } = CONGESTION_SPECIMEN
  const copy = messages.about.specimen
  const colorDelay = heights.length * STAGGER_MS + GROW_MS

  return (
    <div ref={ref}>
      <div role="img" aria-label={copy.congestionAria} className="flex h-16 items-end gap-1.5">
        {heights.map((height, index) => {
          const best = index === bestIndex
          return (
            <span
              key={labels[index]}
              className={cn(
                'block flex-1 origin-bottom rounded-t-sm',
                armed
                  ? 'bg-congestion-bar scale-y-0 transition-none'
                  : [
                      'transition-[transform,background-color] ease-out',
                      best ? 'bg-congestion-best' : 'bg-congestion-bar',
                    ],
              )}
              style={{
                height: `${height}%`,
                transitionDuration: `${GROW_MS}ms, 150ms`,
                transitionDelay: armed ? '0ms' : `${index * STAGGER_MS}ms, ${colorDelay}ms`,
              }}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {labels.map((label, index) => (
          <span
            key={label}
            className={cn(
              'text-caption flex-1 text-center',
              index === bestIndex ? 'text-congestion-best font-bold' : 'text-fg-muted',
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="text-caption text-fg-muted mt-3 font-medium">
        {copy.congestionBest.replace('{date}', bestDate)}
      </p>
    </div>
  )
}
