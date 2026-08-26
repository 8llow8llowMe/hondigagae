import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type EmptyStateProps = {
  title: string
  description?: string | undefined
  /** 재시도가 아니라 **다음 행동** 이다 (예: "필터 초기화") */
  action?: ReactNode
  className?: string
}

/**
 * 데이터 부재(404 / 결과 0건) 전용.
 *
 * **`onRetry` 를 추가하지 않는다.** 404 에 재시도 버튼을 붙이는 경로가 열린다
 * — docs/api-integration-guide.md §3, component-guide.md §10.
 * 일시 장애는 ErrorState 를 쓴다.
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-16 text-center', className)}>
      {/* 중립 톤 — danger 를 쓰지 않는다 (DESIGN.md §2) */}
      <h2 className="text-title-2 text-fg font-semibold">{title}</h2>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
      {action}
    </div>
  )
}
