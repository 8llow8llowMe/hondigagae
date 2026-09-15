import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import type { PlanStatusActionKind, PlanStatusActionSpec } from '@/lib/plan/status-action'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type PlanStatusActionPanelProps = {
  actions: PlanStatusActionSpec[]
  labels: Record<PlanStatusActionKind, string>
  errorMessage: string | null
  saving: boolean
  onAction: (action: PlanStatusActionSpec) => void
}

/**
 * 일정 상태 버튼 줄. 조회·mutation 은 바깥(`PlanStatusAction`)이 갖는다 —
 * React Query 컴포넌트는 renderToStaticMarkup 으로 못 본다.
 */
export function PlanStatusActionPanel({
  actions,
  labels,
  errorMessage,
  saving,
  onAction,
}: PlanStatusActionPanelProps) {
  if (actions.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2', INSET_CLASS.card)}>
      {actions.map((action) => (
        <Button
          key={action.kind}
          variant={action.variant}
          onClick={() => onAction(action)}
          loading={saving}
          className="w-full"
        >
          {labels[action.kind]}
        </Button>
      ))}
      <FormAlert message={errorMessage} />
    </div>
  )
}
