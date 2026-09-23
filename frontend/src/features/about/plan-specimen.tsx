'use client'

import { useState } from 'react'

import { PLAN_SPECIMEN } from '@/features/about/about-specimen-data'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

const TAB_ID_PREFIX = 'about-plan-tab-'
/** 패널은 하나다 — 탭마다 패널을 두지 않으므로 id 도 고정이다 */
const PANEL_ID = 'about-plan-panel'

/**
 * AI 일정 예시 — 일자 탭이 **실제로 눌린다** (#635, 명세 §5-4 c · §6-4). 자동 순환은 없다.
 * 고정 예시 3세트 사이만 오간다. `하루만 다시 짜기` 는 기능이 있다는 표시일 뿐 링크가 아니다 —
 * 예시 안에 실제 라우트를 심으면 "이 화면이 그 기능" 으로 읽힌다. 실제 진입은 절의
 * `AI 일정 만들기` 링크가 맡는다.
 *
 * URL `searchParams` 에 두지 않는다 — 필터가 아니라 그림의 페이지 넘김이다(architecture-guide
 * §10 의 대상은 목록 필터·정렬·탭이고, 이 탭은 데이터에 영향이 없다).
 *
 * 탭 조작은 `ai-plan-place-picker-sheet.tsx` 의 `PickerTabs` 를 그대로 따른다 — 이 저장소의
 * 다른 `role="tab"` 이 거기 하나뿐이고, 예시라고 해서 키보드 규약이 달라질 이유가 없다.
 */
export function PlanSpecimen() {
  const [selected, setSelected] = useState(0)
  const copy = messages.about.specimen
  const day = PLAN_SPECIMEN[selected] ?? PLAN_SPECIMEN[0]

  function move(step: number): void {
    const next = (selected + step + PLAN_SPECIMEN.length) % PLAN_SPECIMEN.length
    focusTab(next)
  }

  function focusTab(next: number): void {
    setSelected(next)
    /*
      **포커스도 따라간다** (APG tabs 패턴, picker sheet 와 같다). roving tabindex 는 선택된
      탭 하나만 탭 키 순서에 두는데, 화살표로 선택만 옮기고 포커스를 두고 오면 사용자는
      `tabIndex={-1}` 이 된 버튼 위에 남아 다음 화살표의 출발점을 잃는다.
    */
    document.getElementById(`${TAB_ID_PREFIX}${next}`)?.focus()
  }

  return (
    <div>
      {/*
        **화살표는 탭 버튼이 받는다** — `tablist` 자신이 아니다. 컨테이너에 키 핸들러를 달면
        포커스를 못 받는 요소가 키보드를 다루게 되고(`jsx-a11y/interactive-supports-focus`),
        실제로 키가 오는 곳은 포커스를 가진 **탭** 이다.
      */}
      <div role="tablist" aria-label={copy.planTablistLabel} className="flex gap-1.5">
        {PLAN_SPECIMEN.map((entry, index) => {
          const active = index === selected
          return (
            <button
              key={entry.day}
              type="button"
              role="tab"
              id={`${TAB_ID_PREFIX}${index}`}
              aria-selected={active}
              aria-controls={PANEL_ID}
              // roving tabindex — 선택된 탭 하나만 탭 키 순서에 남는다
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') move(1)
                else if (event.key === 'ArrowLeft') move(-1)
                else if (event.key === 'Home') focusTab(0)
                else if (event.key === 'End') focusTab(PLAN_SPECIMEN.length - 1)
                else return

                event.preventDefault()
              }}
              /*
                `min-h-11`(44) 은 예시 안이라도 **실제로 눌리는 컨트롤**이라 손가락에 걸리는
                값이다 (§7 하한이 아니다 · #883). picker sheet 의 탭과 같은 값이다.

                **`rounded-full` 은 `ScrollRailArrows` 가 이미 낸 예외를 따른다** — DESIGN.md
                §5 의 원형은 사진·아바타 몫이지만, 이것은 **알약형 세그먼트 컨트롤**이라
                사각이면 옆 카드·행과 같은 모양이 돼 눌리는 것으로 읽히지 않는다.
              */
              className={cn(
                'text-caption inline-flex min-h-11 items-center rounded-full px-3 font-semibold transition-colors duration-150 ease-out',
                'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
                active ? 'bg-fg text-fg-inverse' : 'bg-band text-fg-muted hover:text-fg',
              )}
            >
              {entry.day}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={`${TAB_ID_PREFIX}${selected}`}
        // 항목이 늘면 패널이 스크롤될 수 있다 — 패널 자체가 포커스를 받아야 키보드로 훑는다
        tabIndex={0}
        className="mt-2 focus-visible:outline-none"
      >
        {/* `role="tabpanel"` 은 바깥 `div` 가 갖는다 — `ul` 에 얹으면 목록 역할이 사라져 `li` 가 부모를 잃는다 */}
        <ul className="grid">
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
      </div>
      {/*
        `text-link` 를 쓰지 않는다 — 누를 수 없는 문구에 링크 색을 주면 보이는 사용자가 클릭을
        기대한다. 실제 진입은 절의 `AI 일정 만들기` 링크가 맡고, 이 줄은 기능이 있다는 표시일
        뿐이라 중립 색으로 둔다.
      */}
      <p className="text-body-2 text-fg-muted mt-2 font-semibold" aria-hidden>
        {copy.planRegenerate} →
      </p>
    </div>
  )
}
