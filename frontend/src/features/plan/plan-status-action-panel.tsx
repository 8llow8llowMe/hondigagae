import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import type { PlanStatusActionKind, PlanStatusActionSpec } from '@/lib/plan/status-action'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

export type PlanStatusActionPanelProps = {
  /**
   * 개요 아래에 설 **정방향 액션 하나**. 없으면(완료 일정) 버튼을 그리지 않는다 (#653).
   *
   * 역방향은 이 패널이 아니라 `⋯` 메뉴가 갖는다 — 명세 D11-2.
   */
  action: PlanStatusActionSpec | undefined
  labels: Record<PlanStatusActionKind, string>
  errorMessage: string | null
  saving: boolean
  onAction: (action: PlanStatusActionSpec) => void
}

/**
 * 일정 상태 버튼 줄. 조회·mutation 은 바깥(`usePlanStatus`)이 갖는다 —
 * React Query 컴포넌트는 renderToStaticMarkup 으로 못 본다.
 *
 * **버튼이 없어도 사라지지 않는다.** 역방향 액션은 메뉴 안에 있고 그 실패를 말할 자리가
 * 여기뿐이라(메뉴는 선택과 동시에 닫힌다), `action` 이 없어도 `errorMessage` 가 있으면
 * 이 자리가 남아야 한다.
 */
export function PlanStatusActionPanel({
  action,
  labels,
  errorMessage,
  saving,
  onAction,
}: PlanStatusActionPanelProps) {
  if (action === undefined && errorMessage === null) return null

  return (
    <div className={cn('flex flex-col gap-2', INSET_CLASS.card)}>
      {action !== undefined && (
        <Button
          variant={action.variant}
          onClick={() => onAction(action)}
          loading={saving}
          className="w-full"
        >
          {labels[action.kind]}
        </Button>
      )}
      <FormAlert message={errorMessage} />
    </div>
  )
}
