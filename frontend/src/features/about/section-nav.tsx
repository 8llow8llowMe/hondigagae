'use client'

import { useRef, useState } from 'react'

import { stepAt } from '@/features/about/use-active-step'
import { useScrollFrame } from '@/features/about/use-scroll-frame'
import { cn } from '@/lib/utils/cn'

/** 현재 절을 가르는 기준선 — 뷰포트 위에서 40% (명세 2026-09-25 §4) */
export const SECTION_NAV_LINE = 0.4

export type SectionNavItem = { id: string; label: string }

/**
 * 절 내비 (#915, 명세 2026-09-25 §4) — 1280 이상 왼쪽에 고정된 점 레일.
 *
 * - **랜드마크를 늘리지 않는다.** `nav` 가 아니라 `div` + 목록이다 — 셸의 랜드마크만 둔다는
 *   선행 명세 §8. 목록은 `aria-label` 로 이름을 갖는다.
 * - **1280–1535 는 점만, 1536 이상은 라벨까지 보인다.** 1280 에서 콘텐츠 왼쪽 끝이 104px
 *   (좌우 여백 64 + 밴드 안쪽 40)이라 라벨까지 두면 본문에 닿는다. 점만일 때도 링크 이름은
 *   `sr-only` 라벨이 준다.
 * - **자기 면(흰 면 + 1px 테두리)을 갖는다.** 고정이라 그린 밴드(히어로 · 마무리) 위도 지나가는데,
 *   면이 없으면 회색 점과 글자가 그린 위에서 사라진다. 그림자는 두지 않는다(DESIGN.md §6).
 * - 현재 절은 `aria-current="true"` 와 채운 점. 현재 절 계산은 스무 절도 안 되는 윗변 비교라
 *   스크롤 무대의 `stepAt` 을 그대로 쓴다.
 * - **본문(`main`)이 끝나면 숨는다.** 푸터 글자는 왼쪽 40px 에서 시작해, 1280×800 ·
 *   1366×768 · 1536×864 에서 맨 아래까지 내리면 흰 면이 푸터 소개 문구를 가렸다(#915 검토,
 *   브라우저 재현). 숨은 동안은 `inert` 로 포커스 · 접근성 트리에서도 빠진다.
 * - **알려진 한계:** `list-style: none` 인 목록은 `nav` 밖에서 WebKit(VoiceOver Safari)이 목록
 *   역할을 떼고 `aria-label` 도 함께 사라질 수 있다. `role="list"` 는 eslint
 *   `jsx-a11y/no-redundant-roles` 가 막고 저장소의 다른 목록도 쓰지 않아 따르지 않았다 — 링크
 *   이름은 각 링크의 라벨이 따로 주므로 목록 이름이 빠져도 이동은 된다. 실기기 확인은 못 했다.
 */
export function SectionNav({ label, items }: { label: string; items: readonly SectionNavItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const [pastMain, setPastMain] = useState(false)

  useScrollFrame(() => {
    const tops = items.map(
      ({ id }) => document.getElementById(id)?.getBoundingClientRect().top ?? null,
    )
    const index = stepAt(tops, window.innerHeight * SECTION_NAV_LINE)
    setActive(index === 0 ? null : (items[index - 1]?.id ?? null))

    const nav = ref.current
    const main = nav?.closest('main')
    if (nav !== null && main !== null && main !== undefined) {
      setPastMain(main.getBoundingClientRect().bottom < nav.getBoundingClientRect().bottom)
    }
  })

  return (
    <div
      ref={ref}
      inert={pastMain || undefined}
      className={cn(
        'bg-bg border-border fixed top-1/2 left-4 z-30 hidden -translate-y-1/2 rounded-lg border p-1 transition-opacity duration-150 ease-out xl:block',
        pastMain && 'pointer-events-none opacity-0',
      )}
    >
      <ul aria-label={label} className="grid">
        {items.map((item) => {
          const current = item.id === active
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'text-caption flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md font-semibold 2xl:justify-start 2xl:px-3',
                  'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none',
                  current ? 'text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full transition-colors duration-150 ease-out',
                    current ? 'bg-brand-500' : 'bg-border-strong',
                  )}
                />
                <span className="sr-only 2xl:not-sr-only">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
