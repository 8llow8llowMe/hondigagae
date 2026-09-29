import { messages } from '@/lib/messages'
import type { PlanCompanionSummary } from '@/types/plan'

/**
 * 반려견 삭제 확인창의 동행 일정 문장 (#1042). 수치는 plan-service 가 센다
 * (`GET /plans/companions/{petId}`) — 여기는 **어떤 문장을 세울지**만 정한다.
 *
 * - 0 인 수의 문장은 내지 않는다. 셋 다 0 이면 빈 배열이고 확인창은 기본 설명만 남는다
 * - 순서는 **바뀌는 것 먼저, 그대로인 것 나중**이다 — 미완료 → 그중 남는 것 → 다녀온 기록
 * - `soleCompanionPlanCount` 는 `editablePlanCount` 의 부분집합이다(서버가 그 안에서 센다).
 *   앞 문장이 없으면 "그중" 이 가리킬 것이 없으므로 내지 않는다
 */
export function petDeleteCompanionLines(summary: PlanCompanionSummary): string[] {
  const { editablePlanCount: editable, soleCompanionPlanCount: sole } = summary
  const lines: string[] = []

  if (editable > 0) {
    lines.push(messages.pet.deleteCompanionEditable.replace('{count}', String(editable)))

    if (sole >= editable) lines.push(messages.pet.deleteCompanionSoleAll)
    else if (sole > 0)
      lines.push(messages.pet.deleteCompanionSoleSome.replace('{count}', String(sole)))
  }

  if (summary.completedPlanCount > 0) {
    lines.push(
      messages.pet.deleteCompanionCompleted.replace('{count}', String(summary.completedPlanCount)),
    )
  }

  return lines
}
