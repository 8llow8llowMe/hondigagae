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

// ─── 장소 담기 (#82) ──────────────────────────────────────────────────────────

/**
 * `title` 상한. 백엔드 `PlanItemRequest.title` 의 `@Size(max = 100)` 이다.
 *
 * **서버는 넘치면 자르지 않고 `PLAN_100` 을 낸다.** 장소 제목을 그대로 복사하는
 * 담기 경로에서는 화면이 미리 잘라야 한다 (F3). 사용자가 쓴 글이 아니라 복사해 온
 * 이름이라 잘라도 잃는 것이 없다.
 *
 * mock 의 동명 상수(`src/lib/api/mock/plan-data.ts`)와 값이 같지만 **별개다** —
 * 그쪽은 서버 역할이라 검증하는 쪽이고, 이쪽은 요청을 만드는 쪽이다.
 */
export const ITEM_TITLE_MAX = 100

/**
 * 그 일자에 이미 담긴 장소 id.
 *
 * **서버는 중복을 막지 않는다.** 화면이 먼저 막지 않으면 같은 곳이 두 번 담긴 일정이
 * 조용히 만들어진다 (F1·F5-4).
 *
 * `itemType` 을 보지 않는다 — 같은 장소가 `MEAL` 로 담겨 있어도 또 담을 이유가 없다.
 * `targetId` 가 null 인 항목(`MOVE`)은 자연히 빠진다.
 */
export function placeIdsOf(items: PlanItemDetail[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.targetId !== null) ids.add(item.targetId)
  }
  return ids
}

/**
 * 그 일자의 **맨 끝에** 장소 하나를 붙인 일괄 교체 본문.
 *
 * **새 API 가 없다.** 담기도 일자 편집과 같은 `PUT …/days/{day}/items` 라, 기존 항목을
 * 전부 되싣고 하나를 더한 목록을 보낸다 — 되싣지 않으면 그 일자가 새 항목 하나만
 * 남기고 비워진다 (E1).
 *
 * `itemType` 은 **`PLACE` 고정**이다. 식사·숙박 구분과 `WALK` 는 이 이슈 밖이다
 * (F3 — `walk_course` 조회 API 가 없다).
 *
 * 순서는 **맨 끝**이다. 위치를 고르는 UI 는 두지 않는다 — 순서는 편집모드가 소유한다
 * (F5-3).
 */
export function appendPlaceItemPayload(
  items: PlanItemDetail[],
  day: number,
  place: { placeId: string; title: string },
): PlanDayItemsReplacePayload {
  const existing = items.map((item, index) => toPayloadItem(item, day, index))

  return {
    items: [
      ...existing,
      {
        day,
        sequence: existing.length,
        itemType: 'PLACE',
        // 문자열 그대로다 — Snowflake 라 Number() 를 거치면 정밀도를 잃는다 (E1 규칙 1)
        targetId: place.placeId,
        title: place.title.slice(0, ITEM_TITLE_MAX),
      },
    ],
  }
}
