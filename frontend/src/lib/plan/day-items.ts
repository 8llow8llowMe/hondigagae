import { isPlaceTarget } from '@/lib/plan/detail'
import { toInputStartTime } from '@/lib/plan/start-time'
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
  /**
   * 편집 중인 시작 시각 (#623 · 명세 G3). **`HH:mm` 또는 `''`** —
   * `<input type="time">` 의 값 그대로다.
   *
   * **`item.startTime` 을 직접 고치지 않는다.** `item` 은 서버가 준 것이고, 그것을
   * 덮어쓰면 "바뀐 것이 있나"(`hasEditChanges`)를 잴 기준이 사라진다.
   */
  startTime: string
}

export function toEditItems(items: PlanItemDetail[]): PlanDayEditItem[] {
  return items.map((item) => ({
    item,
    removed: false,
    startTime: toInputStartTime(item.startTime),
  }))
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

/** 편집 중인 시각을 바꾼다 (#623 · 명세 G3). `value` 는 `HH:mm` 또는 `''`(지우기) 다 */
export function setEditStartTime(
  items: PlanDayEditItem[],
  index: number,
  value: string,
): PlanDayEditItem[] {
  if (index < 0 || index >= items.length) return items

  return items.map((entry, position) =>
    position === index ? { ...entry, startTime: value } : entry,
  )
}

/**
 * 저장할 것이 있는가.
 *
 * **순서 · 삭제 표시 · 시각 셋 다 본다.** 변경이 없으면 저장 버튼을 잠근다 — 같은 목록을
 * 다시 보내면 `planItemId` 만 전부 새로 발급되고 얻는 것이 없다. 시각만 고친 편집에서
 * 저장 버튼이 잠겨 있으면 고친 값을 저장할 방법이 없다 (명세 G3-2).
 *
 * **시각은 정규화된 값끼리 비교한다.** 서버 `'10:30:00'` 과 입력 `'10:30'` 은 같은
 * 값이다 — 원문으로 비교하면 아무것도 안 고쳐도 저장 버튼이 열린다.
 */
export function hasEditChanges(items: PlanDayEditItem[], original: PlanItemDetail[]): boolean {
  if (items.some((entry) => entry.removed)) return true
  if (items.length !== original.length) return true

  return items.some((entry, index) => {
    const originalItem = original[index]
    if (originalItem === undefined) return true
    if (entry.item.planItemId !== originalItem.planItemId) return true

    return entry.startTime !== toInputStartTime(originalItem.startTime)
  })
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
 * 2. **`memo` · `itemType` 을 되돌려 싣는다** — 일괄 교체라 빼먹으면 순서만 바꿨는데
 *    메모가 지워진다. **`startTime` 은 그대로 되싣지 않는다** — 화면이 이제 시각을
 *    편집하므로(#623 · 명세 G3) 여기서는 **편집 중인 값**(`entry.startTime`)을 싣는다
 * 3. **`sequence` 를 0부터 다시 매긴다** — 화면의 배열 순서가 정본이다
 * 4. **`day` 를 경로값 그대로 싣는다** — 서버가 덮어쓰지만 `@Min(1)` 이 먼저 돈다
 */
export function planDayItemsPayload(
  items: PlanDayEditItem[],
  day: number,
): PlanDayItemsReplacePayload {
  return {
    items: items
      .filter((entry) => !entry.removed)
      .map((entry, index) => toEditedPayloadItem(entry, day, index)),
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

/**
 * 편집 중인 항목 → 요청 본문 항목. **`toPayloadItem` 과 갈리는 지점이 `startTime`
 * 하나다** — 나머지(targetId · title · memo · itemType)는 서버가 준 `item` 을 그대로
 * 되싣지만, 시각만은 사용자가 지금 편집 중인 `entry.startTime` 을 싣는다 (명세 G3).
 *
 * **`:00` 을 붙여 `HH:mm:ss` 로 보낸다.** 스키마 `example` 과 mock 픽스처가 그 모양이고,
 * 서버가 `HH:mm` 도 받는지는 실호출로 확인하지 못했다 — 확실한 쪽으로 보낸다
 * (`start-time.ts` 주석 · D14-8 미결 1).
 *
 * **`''` 는 키를 뺀다 = 지운다.** 일괄 교체에서는 키 생략이 곧 "비운다" 라서(G1),
 * `PUT /plans/{planId}`(부분 수정, 키 생략 = 유지)와 **반대**다.
 */
function toEditedPayloadItem(
  entry: PlanDayEditItem,
  day: number,
  sequence: number,
): PlanItemPayload {
  const { item } = entry

  return {
    day,
    sequence,
    itemType: item.itemType.code,
    ...(item.targetId === null ? {} : { targetId: item.targetId }),
    title: item.title,
    ...(item.memo === null ? {} : { memo: item.memo }),
    ...(entry.startTime === '' ? {} : { startTime: `${entry.startTime}:00` }),
  }
}

// ─── 장소 담기 (#82) ──────────────────────────────────────────────────────────

/**
 * `title` 상한. 백엔드 `PlanItemRequest.title` 의 `@Size(max = 100)` 이다.
 *
 * **서버는 넘치면 자르지 않고 `PLAN_110` 을 낸다.** 장소 제목을 그대로 복사하는
 * 담기 경로에서는 화면이 미리 잘라야 한다 (F3). 사용자가 쓴 글이 아니라 복사해 온
 * 이름이라 잘라도 잃는 것이 없다.
 *
 * mock 의 동명 상수(`src/lib/api/mock/plan-data.ts`)와 값이 같지만 **별개다** —
 * 그쪽은 서버 역할이라 검증하는 쪽이고, 이쪽은 요청을 만드는 쪽이다.
 */
export const ITEM_TITLE_MAX = 100

/**
 * 그 일자에 이미 담긴 **장소** id.
 *
 * **서버는 중복을 막지 않는다.** 화면이 먼저 막지 않으면 같은 곳이 두 번 담긴 일정이
 * 조용히 만들어진다 (F1·F5-4).
 *
 * **`isPlaceTarget` 으로 거른다** — `PLACE`/`MEAL`/`LODGING` 의 `targetId` 만 `place.id` 이고
 * **`WALK` 의 `targetId` 는 `walk_course.id` 라 다른 네임스페이스다.** 걸러내지 않으면 우연히
 * 값이 겹치는 장소가 `이미 담았어요` 로 잠겨, 담을 수 있는 곳을 담지 못한다 —
 * 버튼이 사라져 우회로도 없다. 같은 구분을 항목 보강도 쓴다 (`lib/plan/detail.ts`).
 *
 * `MEAL`·`LODGING` 은 포함한다 — 같은 장소가 식사로 담겨 있어도 또 담을 이유가 없다.
 */
export function placeIdsOf(items: PlanItemDetail[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (isPlaceTarget(item) && item.targetId !== null) ids.add(item.targetId)
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
 * `itemType` 은 **`PLACE` 고정**이다. 식사·숙박 구분은 이 이슈 밖이다. **`WALK` 담기는
 * 이 함수를 쓰지 않는다** — [#382](https://github.com/8llow8llowMe/hondigagae/issues/382)로
 * `walk_course` 조회 API 가 생겨 더 이상 막힌 것이 아니고, `appendWalkCourseItemPayload`
 * (아래)가 자매 함수로 따로 있다 — 중복 판정(`placeIdsOf` vs `walkCourseIdsOf`)과 `title`
 * 조립 규칙이 갈려 인자로 합치지 않았다 (`올레담기-세부명세.md` D3-1).
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

// ─── 산책 코스 담기 (#620) ────────────────────────────────────────────────────

/**
 * 그 일자에 이미 담긴 **산책 코스** id. `placeIdsOf` 의 자매다.
 *
 * **`placeIdsOf` 를 재사용하지 않는다.** 그 함수는 `isPlaceTarget` 으로 `WALK` 를
 * **일부러 걸러낸다** — 코스를 장소 id 집합으로 재면 값이 우연히 겹치는 장소가 있어도
 * 없어도 중복이 영원히 잡히지 않는다.
 *
 * 반대로 **코스 판정에 `placeIdsOf` 의 결과를 섞지 않는다.** 우연히 값이 겹치는 장소가
 * 담겨 있으면 담을 수 있는 코스가 잠긴다 — 버튼이 사라져 우회로가 없다. #82 가 겪은
 * 결함의 거울상이다 (`올레담기-세부명세.md` D3-2).
 *
 * 판정은 `itemType.code === 'WALK' && targetId !== null` 이다. **`isPlaceTarget` 의
 * 부정이 아니다** — `MOVE` 가 그 사이에 있다.
 */
export function walkCourseIdsOf(items: PlanItemDetail[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.itemType.code === 'WALK' && item.targetId !== null) ids.add(item.targetId)
  }
  return ids
}

/**
 * 그 일자의 **맨 끝에** 산책 코스 하나를 붙인 일괄 교체 본문. `appendPlaceItemPayload` 의
 * 자매다 (`올레담기-세부명세.md` D3).
 *
 * **`itemType` 이 `WALK` 고정이고 `targetId` 는 `walk_course.id` 다** — `place.id` 와
 * 다른 네임스페이스다. **서버가 저장 시 이 id 를 검증하지 않는다**
 * (`verifyPlaceTargets` 가 `PLACE_TARGETS`(`PLACE`·`MEAL`·`LODGING`)만 본다 — D3-3).
 * 틀린 id 를 실어도 조용히 저장되고 그 항목은 영원히 제목만 남으므로, **여기서 id 를
 * 지어내거나 가공하지 않는다** — 코스 상세 응답의 `walkCourseId` 를 그대로 받는다.
 *
 * `title` 은 호출부가 `{courseLabel} {name}` 을 조립해 넘긴다 (D3 결정 근거 D8-2) —
 * 요약이 `null` 로 오는 경로가 실재해(D3-3 · tour-service 장애) 그때 남는 것은 `title`
 * 뿐이다.
 */
export function appendWalkCourseItemPayload(
  items: PlanItemDetail[],
  day: number,
  course: { walkCourseId: string; title: string },
): PlanDayItemsReplacePayload {
  const existing = items.map((item, index) => toPayloadItem(item, day, index))

  return {
    items: [
      ...existing,
      {
        day,
        sequence: existing.length,
        itemType: 'WALK',
        // 문자열 그대로다 — Snowflake 라 Number() 를 거치면 정밀도를 잃는다 (E1 규칙 1)
        targetId: course.walkCourseId,
        title: course.title.slice(0, ITEM_TITLE_MAX),
      },
    ],
  }
}
