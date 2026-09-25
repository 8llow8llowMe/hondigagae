'use client'

import { useRef, useState } from 'react'

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
 *
 * **막대가 버튼이다** (#916, 명세 2026-09-25 §5). hover · 포커스 · 탭하면 날짜와 수준
 * (`CongestionLevel` 서버 어휘)이 툴팁으로 뜬다. 같은 문장이 버튼 이름(`aria-label`)이라 툴팁
 * 자체는 `aria-hidden` 이다. 막대 묶음은 이제 그림(`role="img"`)이 아니라 이름 있는 버튼
 * 묶음(`role="group"`)이다 — `img` 안의 버튼은 접근성 트리에서 사라진다.
 *
 * 탭하면 열리고(토글 아님) 포커스가 빠지면 닫힌다. hover 는 `group-hover:` 인데 Tailwind v4 가
 * 이것을 `@media (hover: hover)` 안에 넣어 터치에서는 받쳐 주지 않는다.
 *
 * 누르는 자리는 막대 칸 전체(높이 64)이고 좌우로 2 씩 넓힌다(`before:`). 첫 · 마지막 막대의
 * 툴팁은 가장자리에 붙인다 — 가운데 정렬이면 375 에서 카드 밖으로 넘친다(시안 실측 2px).
 */
export function CongestionSpecimen() {
  const ref = useRef<HTMLDivElement>(null)
  const phase = useRevealOnce(ref, true)
  const armed = phase === 'armed'
  const { heights, labels, bestIndex, bestDate } = CONGESTION_SPECIMEN
  const copy = messages.about.specimen
  const colorDelay = heights.length * STAGGER_MS + GROW_MS
  /** 탭 · 포커스로 연 툴팁 — hover 는 CSS(`group-hover`)가 맡는다 */
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div ref={ref}>
      <div role="group" aria-label={copy.congestionAria} className="flex h-16 items-end gap-1.5">
        {heights.map((height, index) => {
          const best = index === bestIndex
          const date = CONGESTION_SPECIMEN.dates[index] ?? ''
          const label = best
            ? copy.congestionBarBest.replace('{date}', date)
            : copy.congestionBar
                .replace('{date}', date)
                .replace('{level}', CONGESTION_SPECIMEN.levels[index] ?? '')
          const edge =
            index === 0
              ? 'left-0'
              : index === heights.length - 1
                ? 'right-0'
                : 'left-1/2 -translate-x-1/2'
          return (
            <button
              key={labels[index]}
              type="button"
              aria-label={label}
              onClick={(event) => {
                // 토글하지 않는다 — 안드로이드 Chrome 은 탭에 포커스를 줘 onFocus 가 먼저 열고,
                // 토글이면 곧바로 닫혀 막대마다 두 번 눌러야 떴다(#916 검토, Pixel 7 실측).
                // iOS 는 탭에 포커스를 주지 않아 직접 준다 — 닫기는 onBlur 가 맡는다.
                event.currentTarget.focus()
                setOpen(index)
              }}
              onFocus={() => setOpen(index)}
              onBlur={() => setOpen((current) => (current === index ? null : current))}
              className={cn(
                "group relative flex h-full flex-1 items-end before:absolute before:-inset-x-0.5 before:inset-y-0 before:content-['']",
                'focus-visible:ring-brand-500 rounded-t-sm focus-visible:ring-2 focus-visible:outline-none',
              )}
            >
              <span
                className={cn(
                  'block w-full origin-bottom rounded-t-sm',
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
              <span
                aria-hidden
                className={cn(
                  'bg-fg text-fg-inverse text-caption pointer-events-none absolute bottom-full z-10 mb-1 rounded-sm px-2 py-1 font-semibold whitespace-nowrap',
                  edge,
                  /*
                    `opacity-0` 가 아니라 `invisible` 이다 — 정적 마크업에 숨김 투명도가 있으면
                    "JS 없이도 보인다" 단언과 섞인다. 툴팁은 버튼 이름의 되풀이라 내용이 아니다.
                  */
                  open === index ? 'visible' : 'invisible group-hover:visible',
                )}
              >
                {label}
              </span>
            </button>
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
