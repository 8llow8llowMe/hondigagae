'use client'

import { useState } from 'react'

import { SCALE_SPECIMEN } from '@/features/about/about-specimen-data'
import { ScaleCount } from '@/features/about/scale-count'
import { messages } from '@/lib/messages'
import { handleRadioGroupKeyDown, radioTabIndex } from '@/lib/ui/radio-group-keys'
import { cn } from '@/lib/utils/cn'

type ScaleKey = keyof typeof SCALE_SPECIMEN.sourceIndexes

const SCALE_KEYS = ['places', 'emergency', 'sources'] as const satisfies readonly ScaleKey[]

/**
 * 장소 막대 조각 색 — 등급 색이 아닌 브랜드 · 중립(§2-3). 순서는 `placesBreakdown`. 셋째를
 * `--border-strong` 으로 두면 입력 테두리 · 정보 없음 점선의 색이라 "정보 없음" 조각처럼 읽힌다
 * (#940 검토) — 글자 회색(`--fg-muted`)을 칠한다. 불릿 점(`bg-fg-muted`)과 같은 쓰임이다.
 */
const SEGMENT_CLASS = ['bg-brand-700', 'bg-brand-500', 'bg-fg-muted'] as const

/**
 * 데이터 절의 규모 타일 · 구성 · 출처 (#940).
 *
 * **숫자를 누르면 그 숫자가 어디서 왔는지 보여 준다.** 예전에는 숫자 셋 · 출처 목록 · 규칙이
 * 따로 서서, 315 가 무엇을 합친 값인지 읽을 수 없었다. 타일을 고르면 아래에 구성(장소는 원천별
 * 막대)이 서고, 출처 목록에서 그 숫자에 이어지는 원천만 브랜드 테두리로 선다.
 *
 * **타일은 라디오 묶음이다** (#940 검토). 늘 하나만 골라지는데 `aria-pressed` 토글이면 스크린리더가
 * "해제할 수 있는 버튼" 으로 읽는다. 화살표 · Home · End 로 옮기고 고른 것만 탭 순서에 선다 —
 * `Chip`(exclusive) 과 같은 `radio-group-keys` 를 쓴다.
 *
 * - **정적 렌더는 장소가 골라진 상태다** — 구성 · 출처가 처음부터 DOM 에 있다. 숫자는
 *   `ScaleCount` 가 화면에 들어올 때 한 번 센다(최종값은 `sr-only`).
 * - **같은 숫자를 두 번 적지 않는다** — 구성 문장에 315 · 214 를 되풀이하지 않는다
 *   (`about-view.test.ts` "규모 숫자는 타일 한 곳에만").
 * - 출처 이름은 `messages.footer.sources` 를 그대로 읽는다 — 푸터(데스크톱)와 이 화면(모바일)의
 *   출처가 갈리지 않게. 쓰임(`sourceUses`)은 그 목록과 같은 순서다.
 * - 구성이 바뀌어도 알리지 않는다(`aria-live` 없음) — 고른 라디오가 `aria-checked` 로 말하고, 구성
 *   문장은 바로 뒤에 있어 이어 읽힌다.
 * - 숫자는 `display`(28/900) → `md:page`(34/800) 다 — `page` 등급은 800 까지다(DESIGN.md §3-1).
 */
export function DataScale() {
  const copy = messages.about.data
  const [selected, setSelected] = useState<ScaleKey>('places')
  const linked = new Set<number>(SCALE_SPECIMEN.sourceIndexes[selected])
  const placesTotal = SCALE_SPECIMEN.placesBreakdown.reduce((sum, count) => sum + count, 0)

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={copy.scaleGroupLabel}
        className="grid grid-cols-3 gap-2 md:gap-3"
      >
        {SCALE_KEYS.map((key) => {
          const on = key === selected
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={radioTabIndex(on)}
              onClick={() => setSelected(key)}
              onKeyDown={handleRadioGroupKeyDown}
              className={cn(
                'rounded-lg border-2 p-3 text-left transition-colors md:p-4',
                'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
                on
                  ? 'border-brand-700 bg-bg'
                  : 'bg-intro-tint hover:border-border-strong border-transparent',
              )}
            >
              <span className="text-display md:text-page text-fg block font-black tabular-nums md:font-extrabold">
                <ScaleCount value={SCALE_SPECIMEN[key]} />
                {/* 단위는 2px 이 아니라 스케일 안의 4(`ml-1`)로 띄운다 — DESIGN.md §4 */}
                <span className="text-body-2 text-fg-muted ml-1 font-semibold">
                  {copy.scaleUnits[key]}
                </span>
              </span>
              <span className="text-caption text-fg-muted mt-1 block font-semibold break-keep">
                {copy.scaleLabels[key]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="bg-bg border-border mt-3 rounded-lg border p-4">
        <p className="text-body-2 text-fg font-semibold break-keep">
          {copy.scaleBreakdown[selected]}
        </p>
        {selected === 'places' && (
          <>
            <div aria-hidden className="mt-3 flex h-3 gap-1 overflow-hidden rounded-full">
              {SCALE_SPECIMEN.placesBreakdown.map((count, index) => (
                <span
                  key={copy.placesSegments[index]}
                  className={SEGMENT_CLASS[index]}
                  style={{ flexGrow: count / placesTotal }}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {SCALE_SPECIMEN.placesBreakdown.map((count, index) => (
                <li
                  key={copy.placesSegments[index]}
                  className="text-caption text-fg-muted flex items-center gap-1.5 font-medium"
                >
                  <span aria-hidden className={cn('size-2 rounded-sm', SEGMENT_CLASS[index])} />
                  {copy.placesSegments[index]}
                  <span className="text-fg font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <h3 id="about-sources-heading" className="text-caption text-fg-muted mt-4 font-semibold">
        {messages.footer.sourcesLabel}
      </h3>
      <ul aria-labelledby="about-sources-heading" className="mt-2 flex flex-wrap gap-1.5">
        {messages.footer.sources.map((source, index) => (
          <li
            key={source}
            className={cn(
              'rounded-md border px-3 py-1.5 transition-colors',
              linked.has(index) ? 'border-brand-500 bg-row-selected' : 'border-border bg-bg',
            )}
          >
            <span
              className={cn(
                'text-body-2 block font-semibold',
                linked.has(index) ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {source}
            </span>
            <span className="text-caption text-fg-muted block font-medium">
              {copy.sourceUses[index]}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-fg-muted mt-3 font-medium">{copy.scaleNote}</p>
    </div>
  )
}
