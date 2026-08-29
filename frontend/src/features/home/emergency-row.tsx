import Link from 'next/link'

import { ChevronRightIcon, EmergencyIcon } from '@/components/icons'
import { messages } from '@/lib/messages'

/**
 * 병원 · 약국 진입 — 아트보드 `01 홈` 하단 / `02 홈` 좌측 하단.
 *
 * **흰 표면 + 아이콘만 danger 색.** 배경을 붉게 칠하지 않는다 — 상시 진입점이지
 * 경보가 아니다. 붉은 면이 늘 떠 있으면 진짜 경보를 구분할 수 없다.
 *
 * **모든 상태에서 남는다.** 오류·빈 화면에서도 제거하지 않는다.
 */
export function EmergencyRow() {
  return (
    <Link
      href="/emergency"
      className="focus-visible:ring-brand-500 flex items-center gap-3 px-4 py-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none md:px-6 md:py-5"
    >
      <EmergencyIcon size={24} className="text-danger-500 shrink-0" />
      <span className="flex-1">
        <span className="text-body-1 text-fg block font-semibold">
          {messages.home.emergencyTitle}
        </span>
        <span className="text-caption text-fg-muted block font-medium tabular-nums">
          {messages.home.emergencyDesc}
        </span>
      </span>
      <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
    </Link>
  )
}
