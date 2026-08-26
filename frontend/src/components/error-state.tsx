import { Button } from '@/components/button'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

export type ErrorStateProps = {
  title: string
  description?: string | undefined
  /** 필수 prop 이다. optional 로 두면 빠진다 (component-guide.md §10) */
  onRetry: () => void
  retryLabel?: string
  className?: string
}

/** 일시 장애(5xx·무응답) 전용. 데이터 부재는 EmptyState 를 쓴다 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = messages.common.retry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-16 text-center', className)}>
      <h2 className="text-title-2 text-danger-500 font-semibold">{title}</h2>
      {description !== undefined && <p className="text-body-2 text-fg-muted">{description}</p>}
      <Button variant="secondary" size="sm" className="mt-1" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  )
}
