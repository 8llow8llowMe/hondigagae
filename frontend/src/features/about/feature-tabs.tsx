'use client'

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

import { Surface } from '@/components/surface'
import { useScrollFrame } from '@/features/about/use-scroll-frame'
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
 * 스크롤이 목록을 넘기는 조건 — 1024 이상 · 감속 모션이 아님. `globals.css` 의 `.about-tour`
 * 미디어 쿼리와 **같은 문자열**이어야 한다(트랙이 길어지는 조건과 재는 조건이 갈리면 안 된다).
 */
export const TOUR_MEDIA = '(min-width: 64rem) and (prefers-reduced-motion: no-preference)'

/** 항목 하나가 차지하는 스크롤 길이 — 뷰포트 높이의 비율. `globals.css` `--about-tour-step` 과 같다 */
export const TOUR_STEP = 0.35

/**
 * 트랙 윗변(헤더 기준으로 지나온 거리) → 고른 항목. 트랙이 헤더 밑에 닿기 전은 0, 한 항목마다
 * `step` 만큼 스크롤하면 다음 항목, 마지막 항목에서 멈춘다.
 *
 * 순수 함수로 뗀 이유는 `stepAt` 과 같다 — 훅은 node 테스트에서 돌릴 수 없다.
 */
export function tourIndexAt(scrolled: number, step: number, count: number): number {
  if (step <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.floor(scrolled / step)))
}

function readHeaderHeight(): number {
  return (
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) ||
    0
  )
}

/**
 * 질문 3 — 네 항목 목록 + 예시 하나 (#940).
 *
 * 예전에는 카드 넷(제목 · 설명 · 예시)이 2×2 로 섰다. 1280×800 에서도 한 화면에 다 들어오지
 * 않았고, 넷이 저마다 인터랙션(막대 · 일자 탭 · 다시 짜기)을 가져 초점이 넷으로 갈렸다. 앞뒤
 * 절은 "질문 하나 → 그림 하나" 인데 이 절만 카탈로그였다.
 *
 * - **1024 이상은 스크롤이 목록을 한 항목씩 넘긴다**(`.about-tour`). 절이 헤더 아래 한 화면에
 *   붙어 있는(sticky) 동안 항목마다 뷰포트의 35% 를 스크롤하면 다음 항목이 골라지고, 마지막
 *   항목 뒤에 붙임이 풀린다. **누르면 그 항목의 스크롤 자리로 간다** — 누른 값과 스크롤 위치가
 *   갈리지 않게. 가는 동안(부드러운 스크롤) 중간 항목을 거쳐 깜빡이지 않도록 목표를 잠시 쥔다.
 *   감속 모션이면 넘기지 않고 누르기만 한다(트랙도 길어지지 않는다). 1024 미만은 가로 칩 + 누르기다.
 * - **자동으로 넘기지 않는다.** 시간이 넘기는 것이 아니라 사용자의 스크롤이 넘긴다(WCAG 2.2.2).
 * - **머리(`head`) · 바로가기(`link`) · 예시(`panel`)는 서버에서 렌더된 노드다.** 이 경계는 선택
 *   상태와 트랙만 갖는다 — `ScrollStage` 가 `copy` · `visual` 을 받는 것과 같은 방식이다.
 * - **고른 패널만 선다**(`.about-tab-panel`, `display: none`). 숨은 패널 안 버튼은 포커스를
 *   받지 않는다. 카드 높이는 1024 이상에서 최소 높이(`.about-tab-card`)로 맞춘다 — 넷의 내용
 *   높이가 달라 넘길 때마다 카드가 늘었다 줄었다 했다. 정적 렌더는 첫 항목이다.
 * - **URL 에 두지 않는다.** 필터 · 탭 URL 규칙(`architecture-guide.md` §10)은 화면의 데이터를
 *   고르는 탭 몫이다. 이것은 고정값 예시를 넘겨 보는 시연이라 `PlanSpecimen` 의 일자 탭과 같다.
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
  head,
  link,
}: {
  label: string
  items: readonly FeatureTabItem[]
  head: ReactNode
  link: ReactNode
}) {
  const [selected, setSelected] = useState(0)
  /** 스크롤 프레임에서 지금 고른 항목을 읽는다 — 상태 클로저는 프레임마다 새로 잡히지 않는다 */
  const selectedRef = useRef(0)
  const [vertical, setVertical] = useState(false)
  /** `--header-h` — 매 프레임 계산 스타일을 부르지 않도록 마운트 · resize 에서만 읽는다 */
  const headerHeight = useRef(0)
  const baseId = useId()
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const track = useRef<HTMLDivElement>(null)
  /** 누른 항목으로 가는 부드러운 스크롤 동안 쥐는 목표 — 중간 항목을 거쳐 깜빡이지 않게 */
  const pending = useRef<{ index: number; until: number } | null>(null)
  const tabId = (index: number) => `${baseId}-tab-${index}`
  const panelId = (index: number) => `${baseId}-panel-${index}`

  useEffect(() => {
    const query = window.matchMedia('(min-width: 64rem)')
    const sync = () => setVertical(query.matches)
    const readHeader = () => {
      headerHeight.current = readHeaderHeight()
    }
    sync()
    readHeader()
    query.addEventListener('change', sync)
    window.addEventListener('resize', readHeader)
    return () => {
      query.removeEventListener('change', sync)
      window.removeEventListener('resize', readHeader)
    }
  }, [])

  const choose = (index: number) => {
    selectedRef.current = index
    setSelected(index)
  }

  useScrollFrame(() => {
    const node = track.current
    if (node === null || !window.matchMedia(TOUR_MEDIA).matches) return
    const scrolled = headerHeight.current - node.getBoundingClientRect().top
    const index = tourIndexAt(scrolled, window.innerHeight * TOUR_STEP, items.length)
    const target = pending.current
    if (target !== null) {
      if (index !== target.index && Date.now() < target.until) return
      pending.current = null
    }
    if (index === selectedRef.current) return
    /*
      포커스가 사라질 패널 안에 있었으면 새로 고른 탭으로 옮긴다 (#940 검토) — 패널은
      `display: none` 이 되며 포커스를 `body` 로 떨어뜨린다(키보드 PageDown 실측).
    */
    const active = document.activeElement
    const lostFocus = active instanceof HTMLElement && active.closest('.about-tab-panel') !== null
    choose(index)
    if (lostFocus && node.contains(active)) tabs.current[index]?.focus({ preventScroll: true })
  })

  const select = (index: number, focus: boolean) => {
    choose(index)
    const driven = track.current !== null && window.matchMedia(TOUR_MEDIA).matches
    /*
      트랙이 넘길 때는 스크롤을 이 함수가 맡으므로 포커스가 페이지를 움직이지 않게 한다. 1024
      미만의 가로 칩 레일에서는 기본 포커스가 레일을 칩 쪽으로 옮겨야 한다 — 막으면 키보드로 옮긴
      칩이 화면 밖에 남는다(#940 검토, 375 에서 End).
    */
    if (focus) {
      const tab = tabs.current[index]
      tab?.focus(driven ? { preventScroll: true } : undefined)
      // 포커스의 자동 스크롤은 브라우저마다 가로 레일을 따라가지 않기도 해 직접 옮긴다
      if (!driven) tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    const node = track.current
    if (node === null || !driven) return
    const step = window.innerHeight * TOUR_STEP
    const trackTop = node.getBoundingClientRect().top + window.scrollY - headerHeight.current
    pending.current = { index, until: Date.now() + 1600 }
    window.scrollTo({ top: trackTop + index * step + step / 2, behavior: 'smooth' })
  }

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
    select(next, true)
  }

  return (
    <div
      ref={track}
      className="about-tour"
      style={{ '--about-tour-count': items.length } as CSSProperties}
    >
      <div className="about-tour-sticky">
        {/*
          1024 이상은 카피 5 : 예시 7 에 예시가 세 행(머리 · 목록 · 링크)에 걸친다. 그 미만은
          머리 → 칩 → 예시 → 링크로 쌓인다.
        */}
        <div className="about-tour-grid grid w-full lg:grid-cols-12 lg:items-start lg:gap-x-10">
          <div className="lg:col-span-5">{head}</div>
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
              '-mx-4 -my-1.5 mt-4 flex scrollbar-none gap-1.5 overflow-x-auto px-4 py-1.5',
              'lg:col-span-5 lg:m-0 lg:mt-6 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0',
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
                  onClick={() => select(index, false)}
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
          <Surface className="about-tab-card -mx-4 mt-4 md:mx-0 lg:col-span-7 lg:col-start-6 lg:row-span-3 lg:row-start-1 lg:mt-0 lg:w-full lg:max-w-140 lg:self-center lg:justify-self-center">
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
          <div className="mt-4 lg:col-span-5 lg:mt-3">{link}</div>
        </div>
      </div>
    </div>
  )
}
