'use client'

import { useState } from 'react'

import { PLAN_SPECIMEN } from '@/features/about/about-specimen-data'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * AI 일정 예시 — 일자 탭이 **실제로 눌린다** (#635, 명세 §5-4 c · §6-4). 자동 순환은 없다.
 * 고정 예시 3세트 사이만 오간다. `하루만 다시 짜기` 는 기능이 있다는 표시일 뿐 링크가 아니다 —
 * 예시 안에 실제 라우트를 심으면 "이 화면이 그 기능" 으로 읽힌다. 실제 진입은 절의
 * `AI 일정 만들기` 링크가 맡는다.
 *
 * URL `searchParams` 에 두지 않는다 — 필터가 아니라 그림의 페이지 넘김이다(architecture-guide
 * §10 의 대상은 목록 필터·정렬·탭이고, 이 탭은 데이터에 영향이 없다).
 */
export function PlanSpecimen() {
  const [selected, setSelected] = useState(0)
  const copy = messages.about.specimen
  const day = PLAN_SPECIMEN[selected] ?? PLAN_SPECIMEN[0]

  return (
    <div>
      <div role="tablist" aria-label={copy.planTablistLabel} className="flex gap-1.5">
        {PLAN_SPECIMEN.map((entry, index) => {
          const active = index === selected
          return (
            <button
              key={entry.day}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`about-plan-panel-${index}`}
              id={`about-plan-tab-${index}`}
              onClick={() => setSelected(index)}
              className={cn(
                'text-caption inline-flex h-7 items-center rounded-full px-3 font-semibold transition-colors duration-150 ease-out',
                'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
                active ? 'bg-fg text-fg-inverse' : 'bg-band text-fg-muted hover:text-fg',
              )}
            >
              {entry.day}
            </button>
          )
        })}
      </div>
      <ul
        role="tabpanel"
        id={`about-plan-panel-${selected}`}
        aria-labelledby={`about-plan-tab-${selected}`}
        className="mt-2 grid"
      >
        {day.items.map((item, index) => (
          <li
            key={item.time}
            className={cn('flex gap-3 py-2', index > 0 && 'border-border border-t')}
          >
            <span className="text-body-2 text-fg-muted w-11 shrink-0 font-semibold tabular-nums">
              {item.time}
            </span>
            <span>
              <span className="text-body-2 text-fg block font-semibold">{item.title}</span>
              <span className="text-body-2 text-fg-muted block">{item.meta}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-body-2 text-link mt-2 font-semibold" aria-hidden>
        {copy.planRegenerate} →
      </p>
    </div>
  )
}
