import type { ReactNode } from 'react'

import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type EmptyStateProps = {
  title: string
  description?: string | undefined
  /** 재시도가 아니라 **다음 행동** 이다 (예: "필터 초기화") */
  action?: ReactNode
  /** 좌우 여백 축 (DESIGN.md §7). 좌측 레일 안에 놓을 때는 `rail` — `ErrorState` 와 같다 */
  inset?: Inset
  className?: string
}

/**
 * 데이터 부재(404 / 결과 0건) 전용.
 *
 * **좌측 정렬이고 제목은 16/600 이다** (가이드 §5). 가운데 정렬 + 큰 제목은 빈 상태를
 * 사건처럼 보이게 한다 — 빈 것은 사건이 아니다.
 *
 * **비어 있다고 섹션을 숨기지 않는다** — 진입점이 사라진다.
 *
 * **`onRetry` 를 추가하지 않는다.** 404 에 재시도 버튼을 붙이는 경로가 열린다
 * — docs/api-integration-guide.md §3, component-guide.md §10.
 * 일시 장애는 ErrorState 를 쓴다.
 */
export function EmptyState({
  title,
  description,
  action,
  inset = 'main',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-2 py-12', INSET_CLASS[inset], className)}>
      {/* 중립 톤 — danger 를 쓰지 않는다 (DESIGN.md §2) */}
      <h2 className="text-body-1 text-fg font-semibold">{title}</h2>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  )
}
