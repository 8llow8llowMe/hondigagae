'use client'

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'

import { Surface } from '@/components/surface'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type FeatureTabItem = {
  key: string
  title: string
  /** 제목 뒤 작은 표시 — `AI 제안` */
  tag?: string
  desc: string
  /** 서버에서 렌더된 예시 */
  panel: ReactNode
}

/**
 * 질문 3 — 네 항목 목록 + 예시 하나 (#940).
 *
 * 예전에는 카드 넷(제목 · 설명 · 예시)이 2×2 로 섰다. 1280×800 에서도 한 화면에 다 들어오지
 * 않았고, 넷이 저마다 인터랙션(막대 · 일자 탭 · 다시 짜기)을 가져 초점이 넷으로 갈렸다. 앞뒤
 * 절은 "질문 하나 → 그림 하나" 인데 이 절만 카탈로그였다.
 *
 * - **목록과 패널을 둘 다 이 컴포넌트가 그린다** — 선택 상태를 나눠 가져야 해서다. 둘은
 *   부모 그리드의 칸에 따로 선다(`listClassName` · `panelClassName`).
 * - **예시(`panel`)는 서버에서 렌더된 노드다.** 이 경계는 선택 상태만 갖는다 —
 *   `ScrollStage` 가 `copy` · `visual` 을 받는 것과 같은 방식이다.
 * - **고른 패널만 선다**(`.about-tab-panel`, `display: none`). 숨은 패널 안 버튼은 포커스를
 *   받지 않는다. 겹쳐 두고 높이를 가장 긴 패널에 묶는 안은 짧은 패널에서 카드 절반이 비어
 *   버렸다(`globals.css` 질문 3 블록). 정적 렌더는 첫 항목이다 — 네 예시의 문장은 전부 처음부터
 *   DOM 에 있다.
 * - **URL 에 두지 않는다.** 필터 · 탭 URL 규칙(`architecture-guide.md` §10)은 화면의 데이터를
 *   고르는 탭 몫이다. 이것은 고정값 예시를 넘겨 보는 시연이라 `PlanSpecimen` 의 일자 탭과 같다.
 * - **자동으로 넘기지 않는다.** 누르는 중에 바뀌면 방해가 되고 WCAG 2.2.2 에 걸린다.
 * - 키보드: 화살표 네 방향(1024 이상은 세로 목록, 그 미만은 가로 칩) · Home · End. 고른 탭만
 *   `tabIndex=0` 이다(WAI-ARIA Tabs, 자동 활성화). `aria-orientation` 은 보이는 방향을 따라간다 —
 *   정적 렌더는 가로(모바일 1순위)이고 마운트 뒤 1024 이상이면 세로로 바뀐다.
 * - **설명은 패널이 말한다.** 1024 이상에서 고른 탭 아래 펼치는 설명은 `aria-hidden` 이다 —
 *   탭 이름은 제목만이고, 같은 설명을 패널 머리(`lg:sr-only`)가 읽는다. 1024 미만은 칩이 제목만
 *   보이므로 패널 머리가 화면에도 선다.
 */
export function FeatureTabs({
  label,
  items,
  listClassName,
  panelClassName,
}: {
  label: string
  items: readonly FeatureTabItem[]
  listClassName?: string
  panelClassName?: string
}) {
  const [selected, setSelected] = useState(0)
  const [vertical, setVertical] = useState(false)
  const baseId = useId()

  useEffect(() => {
    const query = window.matchMedia('(min-width: 64rem)')
    const sync = () => setVertical(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const tabId = (index: number) => `${baseId}-tab-${index}`
  const panelId = (index: number) => `${baseId}-panel-${index}`

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1
    let next: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
      next = index === last ? 0 : index + 1
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    setSelected(next)
    tabs.current[next]?.focus()
  }

  return (
    <>
      {/*
        1024 미만은 가로 칩 레일 — `Chip`(sm) 과 같은 모양 · 같은 히트 띠(`::before` 위아래 6)다.
        가로 스크롤러는 세로도 잘라서 레일이 `py-1.5 -my-1.5` 로 띠만큼 자리를 준다
        (`emergency-filter-bar.tsx` 선례). 1024 이상은 세로 목록이고 고른 항목만 흰 면에 선다.
      */}
      <div
        role="tablist"
        aria-label={label}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        className={cn(
          '-mx-4 -my-1.5 flex scrollbar-none gap-1.5 overflow-x-auto px-4 py-1.5',
          'lg:m-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0',
          listClassName,
        )}
      >
        {items.map((item, index) => {
          const on = index === selected
          return (
            <button
              key={item.key}
              ref={(node) => {
                tabs.current[index] = node
              }}
              type="button"
              role="tab"
              id={tabId(index)}
              aria-selected={on}
              aria-controls={panelId(index)}
              tabIndex={on ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'group text-body-2 relative h-9 shrink-0 rounded-md border px-3 text-left whitespace-nowrap transition-colors',
                "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
                'md:h-11 md:before:inset-y-0',
                'border-border bg-bg text-fg-muted hover:bg-band font-medium',
                'aria-selected:border-border-strong aria-selected:bg-band aria-selected:text-fg aria-selected:font-semibold',
                'lg:h-auto lg:rounded-lg lg:px-4 lg:py-3 lg:whitespace-normal lg:before:content-none',
                'lg:border-transparent lg:bg-transparent lg:font-semibold',
                'lg:aria-selected:border-border lg:aria-selected:bg-bg',
                'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
              )}
            >
              <span className="lg:text-title-2 block">
                {item.title}
                {item.tag !== undefined && (
                  <span className="text-caption text-fg-muted hidden font-semibold lg:inline">
                    {' '}
                    · {item.tag}
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className="text-body-2 text-fg-muted mt-1 hidden font-normal break-keep lg:group-aria-selected:block"
              >
                {item.desc}
              </span>
            </button>
          )
        })}
      </div>
      <Surface className={cn('-mx-4 md:mx-0', panelClassName)}>
        {items.map((item, index) => (
          <div
            key={item.key}
            role="tabpanel"
            id={panelId(index)}
            aria-labelledby={tabId(index)}
            tabIndex={0}
            className={cn(
              'about-tab-panel focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:rounded-lg',
              index === selected && 'is-selected',
            )}
          >
            <div className={cn('pt-4 lg:sr-only', INSET_CLASS.card)}>
              <p className="text-title-2 text-fg font-semibold">{item.title}</p>
              <p className="text-body-2 text-fg-muted mt-1 break-keep">{item.desc}</p>
            </div>
            <div className={cn('pt-4 pb-4 lg:pt-5', INSET_CLASS.card)}>{item.panel}</div>
          </div>
        ))}
      </Surface>
    </>
  )
}
