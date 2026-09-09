'use client'

import { type ReactNode, useId } from 'react'

import { ChevronDownIcon } from '@/components/icons'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 「더 자세히 정할게요」 — 기본값이 있는 선택 항목을 접는다.
 *
 * **`<details>` 를 쓰지 않는다.** 열림 상태를 React 가 소유해야 `hasAnyDetail` 판정으로
 * 초기값을 정할 수 있는데, `<details open>` 은 uncontrolled 라 사용자가 접은 뒤에도
 * prop 이 다시 열어 버린다.
 *
 * **접혔을 때만 요약을 보인다.** 펼치면 아래에 실제 컨트롤이 있으므로 같은 말을 두 번
 * 하지 않는다.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 */
export function AiPlanDetailsDisclosure({
  open,
  /** 접혔을 때 보여 줄 한 줄 (`lib/ai-plan/details.ts` 의 `detailsSummary`) */
  summary,
  onToggle,
  children,
}: {
  open: boolean
  summary: string
  onToggle: () => void
  children: ReactNode
}) {
  const panelId = useId()

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        // 44px — 모바일 최소 터치 영역 (DESIGN.md §7)
        className="focus-visible:ring-brand-500 -mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronDownIcon
          size={20}
          className={cn('text-fg-subtle shrink-0 transition-transform', open && 'rotate-180')}
        />
        <span className="text-body-1 text-fg font-semibold">{messages.aiPlan.detailsToggle}</span>
        {/*
          접혔을 때만 요약을 낸다. `truncate` 로 한 줄을 지킨다 — 375px 에서 옵션까지
          켜면 줄이 넘치는데, 접힌 줄이 두 줄이 되면 "접었다" 는 인상이 깨진다
        */}
        {!open && <span className="text-body-2 text-fg-muted ms-auto truncate">{summary}</span>}
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-5">
          {children}
        </div>
      )}
    </div>
  )
}
