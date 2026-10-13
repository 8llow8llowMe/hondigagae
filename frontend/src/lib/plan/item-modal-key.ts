/**
 * 일정 상세 항목 모달의 React `key` (#1485).
 *
 * 시각 모달(`PlanItemTimeModal`)과 메모 모달(`PlanItemMemoModal`)은 `plan-detail-section.tsx` 에서 **형제**다.
 * 둘 다 "여는 항목마다 새로 마운트한다" 를 위해 `planItemId` 를 key 로 쓰고 닫히면 `'closed'` 였는데, 그러면
 * 둘 다 닫힌 평소 상태에서 key 가 같아 React 가 형제를 가르지 못했다(`Encountered two children with the same
 * key`). **종류를 앞에 붙여** 닫힘 · 열림 어느 쪽에서도 겹치지 않게 한다. 같은 모달 안에서의 규칙(여는 항목이
 * 바뀌면 새로 마운트, 메모는 연 시점 id 로 유지 — #1460)은 그대로다.
 */

const CLOSED = 'closed'

export function timeModalKey(planItemId: string | null | undefined): string {
  return `time:${planItemId ?? CLOSED}`
}

export function memoModalKey(planItemId: string | null | undefined): string {
  return `memo:${planItemId ?? CLOSED}`
}
