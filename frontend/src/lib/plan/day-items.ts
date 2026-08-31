import type { PlanDayItemsReplacePayload, PlanItemDetail, PlanItemPayload } from '@/types/plan'

/**
 * 일자 편집모드의 순수 로직 — 이동 · 삭제 표시 · 요청 본문 조립.
 *
 * **렌더와 분리한다.** 여기 담긴 규칙은 전부 계약 해석이라 값으로 검증해야 한다.
 * 규칙 근거는 docs/features/plan/일자편집-세부명세.md E1·E4.
 */

/**
 * 편집 중인 항목 하나.
 *
 * **삭제를 배열에서 빼지 않는다.** 취소선 + `복구` 로 보류해 두고 저장 시점에 반영한다 —
 * 빼 버리면 복구가 "다시 넣기" 가 되어 원래 자리를 잃는다 (E4).
 */
export type PlanDayEditItem = {
  item: PlanItemDetail
  /** 저장하면 삭제된다는 표시. 아직 서버 상태는 그대로다 */
  removed: boolean
}

export function toEditItems(items: PlanItemDetail[]): PlanDayEditItem[] {
  return items.map((item) => ({ item, removed: false }))
}

export type MoveDirection = 'up' | 'down'

/**
 * 항목을 한 칸 옮긴다. **경계에서는 배열을 그대로 돌려준다** —
 * 호출부가 참조 동일성으로 "안 움직였다" 를 알 수 있다.
 *
 * **삭제 표시된 항목도 함께 움직인다.** 목록에 남아 있으므로 건너뛰면 눈에 보이는
 * 순서와 배열이 어긋난다.
 */
export function moveEditItem(
  items: PlanDayEditItem[],
  index: number,
  direction: MoveDirection,
): PlanDayEditItem[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= items.length) return items
  if (target < 0 || target >= items.length) return items

  const next = [...items]
  const moved = next[index] as PlanDayEditItem
  next[index] = next[target] as PlanDayEditItem
  next[target] = moved

  return next
}

/** 삭제 표시를 켜고 끈다 */
export function toggleRemoved(items: PlanDayEditItem[], index: number): PlanDayEditItem[] {
  if (index < 0 || index >= items.length) return items

  return items.map((entry, position) =>
    position === index ? { ...entry, removed: !entry.removed } : entry,
  )
}

/**
 * 저장할 것이 있는가.
 *
 * **순서와 삭제 표시 둘 다 본다.** 변경이 없으면 저장 버튼을 잠근다 — 같은 목록을
 * 다시 보내면 `planItemId` 만 전부 새로 발급되고 얻는 것이 없다.
 */
export function hasEditChanges(items: PlanDayEditItem[], original: PlanItemDetail[]): boolean {
  if (items.some((entry) => entry.removed)) return true
  if (items.length !== original.length) return true

  return items.some((entry, index) => entry.item.planItemId !== original[index]?.planItemId)
}

/** 삭제 표시를 뺀, 저장 후 남을 항목들 */
export function survivingItems(items: PlanDayEditItem[]): PlanItemDetail[] {
  return items.filter((entry) => !entry.removed).map((entry) => entry.item)
}

/**
 * 편집 상태 → 일괄 교체 요청 본문.
 *
 * 지키는 것 넷 (E1):
 * 1. **`targetId` 를 문자열로 싣는다** — Snowflake 정밀도
 * 2. **`memo` · `startTime` · `itemType` 을 되돌려 싣는다** — 일괄 교체라 빼먹으면
 *    순서만 바꿨는데 메모와 시각이 지워진다. 화면이 `startTime` 을 표시하지 않는 것과
 *    보존해야 하는 것은 다른 문제다
 * 3. **`sequence` 를 0부터 다시 매긴다** — 화면의 배열 순서가 정본이다
 * 4. **`day` 를 경로값 그대로 싣는다** — 서버가 덮어쓰지만 `@Min(1)` 이 먼저 돈다
 */
export function planDayItemsPayload(
  items: PlanDayEditItem[],
  day: number,
): PlanDayItemsReplacePayload {
  return {
    items: survivingItems(items).map((item, index) => toPayloadItem(item, day, index)),
  }
}

function toPayloadItem(item: PlanItemDetail, day: number, sequence: number): PlanItemPayload {
  return {
    day,
    sequence,
    itemType: item.itemType.code,
    // 대상이 없는 항목(MOVE)은 키 자체를 넣지 않는다. null 을 보내면 의미가 같지만
    // 요청 본문에 빈 값이 남아 계약을 읽기 어려워진다
    ...(item.targetId === null ? {} : { targetId: item.targetId }),
    title: item.title,
    ...(item.memo === null ? {} : { memo: item.memo }),
    ...(item.startTime === null ? {} : { startTime: item.startTime }),
  }
}
