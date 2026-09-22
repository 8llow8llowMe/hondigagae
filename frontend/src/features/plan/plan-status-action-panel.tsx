import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import type { PlanStatusActionKind, PlanStatusActionSpec } from '@/lib/plan/status-action'

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
 *
 * ## `INSET_CLASS.card` 를 쓰지 않는다 (#845)
 *
 * 그 인셋은 **글자의 세로선**을 카드 안 글자와 맞추려는 규칙이다 (`lib/ui/inset.ts` 의
 * `card` 문단: "아래 카드의 첫 글자와 세로선이 갈린다"). 그런데 이 자리에 서는 것은 글자가
 * 아니라 **면을 가진 전폭 버튼**이고, 면의 경계는 글자가 아니라 위아래 `Surface` 의 테두리와
 * 비교된다. 인셋을 주면 버튼이 카드보다 좌우 16(모바일) · 20(데스크톱) 씩 좁아져 **레일의
 * 세로 경계가 버튼 한 줄에서만 안으로 꺾인다** — 768 이상에서 눈에 그대로 걸렸다.
 *
 * 그래서 이 래퍼는 평평하다. `Surface` 가 `border-y md:rounded-lg md:border` 라 카드의
 * 바깥 경계가 곧 이 자리의 폭이고, 버튼과 카드가 같은 세로선에 선다. `FormAlert` 도 같은
 * 폭을 받는다 — 그쪽은 글자지만 **버튼 바로 아래 붙는 부속**이라 버튼의 경계를 따른다.
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
    <div className="flex flex-col gap-2">
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
