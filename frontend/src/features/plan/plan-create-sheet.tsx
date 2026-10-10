'use client'

import Link from 'next/link'

import { BottomSheet } from '@/components/bottom-sheet'
import { messages } from '@/lib/messages'

/**
 * 만들기 방식 시트 — 아트보드 `혼디가개 여행 일정` 04.
 *
 * **AI 일정 생성 화면(#84)이 생겨서 이제 항목이 둘이다.** 그 전에는 선택지가 하나뿐이라
 * 시트를 두지 않았다 — 항목이 하나인 시트는 한 번 더 누르게 할 뿐이다 (공통명세 S2).
 *
 * **여기서 선택 → 그 자리에서 이동.** 두 항목 모두 목적지가 다른 화면이라 `<Link>` 다
 * (`Button` 이 아니다 — 이동을 표현하지 못하는 컴포넌트를 쓰지 않는다, #70).
 */
export function PlanCreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={messages.plan.createSheetTitle}>
      <ul className="flex flex-col gap-2">
        <li>
          <SheetLink
            href="/ai-plans/new"
            label={messages.plan.createSheetAi}
            description={messages.plan.createSheetAiDescription}
            onNavigate={onClose}
          />
        </li>
        <li>
          <SheetLink
            href="/plans/new"
            label={messages.plan.createSheetManual}
            description={messages.plan.createSheetManualDescription}
            onNavigate={onClose}
          />
        </li>
      </ul>
    </BottomSheet>
  )
}

function SheetLink({
  href,
  label,
  description,
  onNavigate,
}: {
  href: string
  label: string
  description: string
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="border-border hover:bg-band focus-visible:ring-brand-500 flex flex-col gap-1 rounded-md border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="text-body-1 text-fg font-semibold">{label}</span>
      <span className="text-body-2 text-fg-muted">{description}</span>
    </Link>
  )
}
