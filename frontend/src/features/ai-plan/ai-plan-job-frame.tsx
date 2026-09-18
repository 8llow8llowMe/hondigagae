import type { ReactNode } from 'react'

import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 작업 상태 카드가 공유하는 골격 (#710) — 진행 · 실패 · 취소.
 *
 * **셋이 같은 이야기의 세 순간이다.** `AiPlanJobShell` 이 이미 한 카드 안에 넣어 두었는데
 * (`ai-plan-job-view.tsx`), 카드 **안쪽**은 상태마다 달랐다 — 진행은 `gap-4 py-10` 에
 * 조건 요약이 없고, 실패·취소는 `gap-3 py-12` 에 조건 요약이 버튼 아래 caption 이었다.
 * 상태가 바뀌면 본문만이 아니라 카드 전체가 다른 모양이 돼서, 같은 화면이 상태마다 다른
 * 화면처럼 읽힌다.
 *
 * 골격은 셋 다 이것이다:
 *
 * ```text
 * 상태 블록   제목 + 그 상태가 하는 말
 * ──────────  1px
 * 조건 블록   무엇을 만들고 있(었)나 — 셋이 같은 자리, 같은 모양
 * ──────────  1px
 * 액션 블록   지금 할 수 있는 일 + 보조 문구
 * ```
 *
 * **선은 카드 폭을 가로지른다.** 그래서 인셋은 바깥이 아니라 **블록마다** 붙는다 — 홈이
 * 카드 안 블록을 잇는 방식과 같다(`home-view.tsx`). `divide-y` 를 쓰면 첫 블록만 선이
 * 없어야 한다는 규약을 호출부가 들고 있지 않아도 된다 (`Surface` 머리주석이 경계하는
 * "호출자가 한 번도 써 보지 않은 규약" 을 만들지 않는다).
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다.
 */
export function AiPlanJobFrame({ children }: { children: ReactNode }) {
  return <div className="divide-border flex flex-col divide-y">{children}</div>
}

/**
 * 골격의 한 블록. 세로 여백을 한 곳에서 정해 셋이 어긋나지 않게 한다.
 *
 * `items-start` 를 기본으로 둔다 — 안에 서는 것이 버튼 행이든 문단이든 왼쪽 기준선에
 * 붙어야 하고, 늘어나서 카드 폭을 채울 이유가 있는 자식이 없다.
 */
export function AiPlanJobBlock({
  inset,
  className,
  children,
}: {
  inset: Inset
  /** **레이아웃 유틸리티만** 받는다 (component-guide.md §3) */
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col items-start gap-2 py-5', INSET_CLASS[inset], className)}>
      {children}
    </div>
  )
}

/**
 * 조건 블록 — **셋이 같은 자리에서 같은 모양으로** 그린다.
 *
 * **진행 화면에도 그린다** (#710). 서버가 생성 조건을 함께 내려주므로(#488)
 * `AiPlanJobView` 가 이미 값을 쥐고 있었는데 실패·취소에만 넘기고 있었다 — 정작 "지금
 * 뭘 만들고 있나" 가 가장 궁금한 것은 기다리는 동안이다.
 *
 * **조건을 잃었으면 블록째 없다.** 다른 기기에서 같은 주소를 열면 실제로 이 상태가 된다
 * (명세 S5 함정 1). 빈 값 자리를 남기면 "조건이 비었다" 로 읽힌다.
 */
export function AiPlanJobCondition({
  inset,
  label,
  summary,
}: {
  inset: Inset
  /** `만드는 조건`(진행) · `그대로 남아 있는 조건`(실패·취소) */
  label: string
  summary: string | null
}) {
  if (summary === null) return null

  return (
    <AiPlanJobBlock inset={inset} className="gap-1">
      <p className="text-caption text-fg-muted">{label}</p>
      <p className="text-body-2 text-fg">{summary}</p>
    </AiPlanJobBlock>
  )
}
