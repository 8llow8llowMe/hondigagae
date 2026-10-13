import { messages } from '@/lib/messages'
import { isCafePlace } from '@/lib/place/cafe'
import { insertedStartTime } from '@/lib/plan/default-start-time'
import { isPlaceTarget } from '@/lib/plan/detail'
import { formatStartTime } from '@/lib/plan/start-time'
import { hasBackwardTime, realignedStartTimes } from '@/lib/plan/time-order'
import { withObjectParticle } from '@/lib/text/korean'
import type {
  PlanDayItemsReplacePayload,
  PlanItemDetail,
  PlanItemPayload,
  PlanItemTypeCode,
} from '@/types/plan'

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

/**
 * **편집 항목은 시각을 들지 않는다** (#1028 · 명세 G0). 시각은 일정 목록의 시간 칩이
 * 소유한다 — 순서 편집 저장은 서버가 준 `item.startTime` 원문을 그대로 되싣는다
 * (`toPayloadItem`). 예전(#623)에는 여기 편집용 `startTime: 'HH:mm' | ''` 가 있었다.
 */
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
 * **순서와 삭제 표시만 본다.** 변경이 없으면 저장 버튼을 잠근다 — 같은 목록을 다시 보내면
 * `planItemId` 만 전부 새로 발급되고 얻는 것이 없다. 시각은 이제 편집모드가 고치지 않는다
 * (#1028 · 명세 G0).
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
 * 2. **`memo` · `startTime` · `itemType` 을 되돌려 싣는다** — 일괄 교체라 빼먹으면 순서만
 *    바꿨는데 메모와 시각이 지워진다. 시각은 편집모드가 고치지 않으므로(#1028 · 명세 G0)
 *    **서버가 준 원문 그대로**다
 * 3. **`sequence` 를 0부터 다시 매긴다** — 화면의 배열 순서가 정본이다
 * 4. **`day` 를 경로값 그대로 싣는다** — 서버가 덮어쓰지만 `@Min(1)` 이 먼저 돈다
 */
export function planDayItemsPayload(
  items: PlanDayEditItem[],
  day: number,
  options: { realignStartTimes?: boolean } = {},
): PlanDayItemsReplacePayload {
  const surviving = survivingItems(items)
  /*
    **시각을 다시 맞추는 것은 사용자가 고른 때만이다** (#1424). 저장 전에 역행을 보면 화면이
    "시각도 순서에 맞게 다시 맞출까요?" 를 묻고(`editStartTimesRegress`), 그렇다고 답했을 때만
    있던 시각을 순서대로 다시 나눠 싣는다(`realignedStartTimes`). 기본은 여전히 원문 그대로다.
  */
  const times =
    options.realignStartTimes === true
      ? realignedStartTimes(surviving.map((item) => item.startTime))
      : null

  return {
    items: surviving.map((item, index) =>
      toPayloadItem(
        times === null ? item : { ...item, startTime: times[index] ?? null },
        day,
        index,
      ),
    ),
  }
}

/**
 * 저장하면 남을 항목의 시각이 **역행하는가** (#1424). 순서 편집은 시각을 고치지 않고 원문을
 * 되싣으므로(#1028 · G0) 순서를 바꾸면 `10:00 → 15:00 → 12:30` 이 그대로 확정됐다 — 저장 전에
 * 물을지를 이것으로 가른다. 겹침만으로는 묻지 않는다 (`hasBackwardTime`).
 */
export function editStartTimesRegress(items: PlanDayEditItem[]): boolean {
  return hasBackwardTime(survivingItems(items).map((item) => item.startTime))
}

/**
 * 항목 하나를 일괄 교체 본문의 한 줄로 되싣는다. 메모 고치기(`item-memo-edit.ts`, #1460)도 이것을
 * 쓴다 — 되싣는 규칙(E1)이 두 벌이 되면 한쪽만 고쳐졌을 때 다른 쪽 저장이 필드를 잃는다.
 */
export function toPayloadItem(
  item: PlanItemDetail,
  day: number,
  sequence: number,
): PlanItemPayload {
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

/*
  항목 하나의 시작 시각만 바꾸는 일괄 교체 본문(`setItemStartTimePayload`, #1028)은 #1053 에서
  걷었다 — 시각 저장이 단건 API(`changeItemStartTime`)로 옮겨 가 이 파일이 만들 본문이 없다.
*/

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
 * 담기가 새 항목을 넣을 자리 — 그날 **끝에 붙은 숙박 앞** (#1175).
 *
 * **맨 끝이 아니다.** 2026-10-06 사용성 점검 2회차에서 `장소 추가` 로 담은 카페가 그날 숙박 뒤에
 * 붙어, 숙소에서 38.7km 를 되돌아가는 순서가 됐다 — 사용자가 순서 편집으로 직접 옮겨야 했다(옮기니
 * 5km). 숙박은 그날의 끝이다. 낮에 갈 곳을 고른 사람이 숙소 다음에 가려는 경우는 드물고, 그렇다면
 * 순서 편집으로 옮긴다 — 반대 방향의 실수보다 싸다.
 *
 * **끝에 연달아 붙은 숙박 묶음만 본다.** 중간의 숙박(아침 체크아웃 · 낮 짐 맡기기)은 그날의 끝이
 * 아니라 건드리지 않는다 — 그 뒤에 이미 낮 일정이 이어진다. 숙박만 있는 날은 맨 앞(0)이다.
 *
 * **이동·휴식 추가(`appendMoveItemPayload`)는 쓰지 않는다** — 숙소 앞 이동인지 숙소에서의 휴식인지
 * 화면이 알 수 없어 예전처럼 맨 끝이다(H7-3).
 */
export function itemInsertIndex(items: PlanItemDetail[]): number {
  let index = items.length
  while (index > 0 && items[index - 1]?.itemType.code === 'LODGING') index -= 1
  return index
}

/**
 * 담기가 새 항목에 채울 시각 (서버 형식 `HH:mm:ss`). 못 채우면 `undefined`.
 *
 * **비우면 그 항목의 산책 위험도가 `NO_START_TIME` 으로 꺼진다** (#1383 · 일정상세-세부명세
 * D24). 끼울 자리(`itemInsertIndex`) **앞 · 뒤** 항목들의 시각을 본다 — 뒤는 대개 끝에 붙은
 * 숙박이고, 그 시각보다 늦게 넣으면 숙소와 겹친다 (#1424). 담기 토스트가 같은 값을 말하도록 본문
 * 조립과 따로 꺼내 둔다. **못 채우면 토스트가 "시각을 정해 주세요" 를 말한다** (`addPlaceToastMessage`).
 */
export function insertedItemStartTime(items: PlanItemDetail[]): string | undefined {
  const at = itemInsertIndex(items)
  const times = items.map((item) => item.startTime)

  return insertedStartTime(times.slice(0, at), times.slice(at))
}

/**
 * 장소 담기 성공 토스트. 시각을 채웠으면 **그 시각과 "바꿀 수 있어요" 를 함께 말한다** —
 * 추천값이라는 사실을 알릴 곳이 여기뿐이다 (D24-2). `use-plan-add-place` · 장소 담기 시트가
 * 같이 쓴다.
 */
export function addPlaceToastMessage(
  title: string,
  day: number,
  startTime: string | undefined,
): string {
  const time = formatStartTime(startTime ?? null)
  const template = time === null ? messages.plan.addPlaceToast : messages.plan.addPlaceTimedToast

  return template
    .replace('{title}', withObjectParticle(title))
    .replace('{day}', String(day))
    .replace('{time}', time ?? '')
}

/** 기존 항목을 되싣고 `itemInsertIndex` 자리에 하나를 끼운 본문. `sequence` 는 0부터 다시 매긴다 */
function insertItemPayload(
  items: PlanItemDetail[],
  day: number,
  added: Omit<PlanItemPayload, 'day' | 'sequence'>,
): PlanDayItemsReplacePayload {
  const at = itemInsertIndex(items)
  const existing = items.map((item, index) =>
    toPayloadItem(item, day, index < at ? index : index + 1),
  )
  const startTime = insertedItemStartTime(items)

  return {
    items: [
      ...existing.slice(0, at),
      { day, sequence: at, ...added, ...(startTime === undefined ? {} : { startTime }) },
      ...existing.slice(at),
    ],
  }
}

/** 장소 담기가 싣는 항목 유형 — 담기 경로는 이 둘만 만든다. 숙박(`LODGING`)은 담기 밖이다 */
export type AddedPlaceItemType = Extract<PlanItemTypeCode, 'PLACE' | 'MEAL'>

/** 담을 장소 하나. `itemType` 은 `placeItemTypeOf` 로 판정한 값이다 */
export type AddedPlace = { placeId: string; title: string; itemType: AddedPlaceItemType }

/**
 * 담을 장소의 일정 항목 유형 (#1447 · 일정상세-세부명세 D26-5).
 *
 * **음식점(`contentType.code === 'RESTAURANT'`)이면 `MEAL`, 아니면 `PLACE`.** 상세 응답의
 * `PlanItemPlace` 에는 `contentType` 이 없어 일정 화면은 담긴 항목이 음식점인지 모른다 — 장소를
 * 아는 것은 담는 순간뿐이라 여기서 가른다. 그래야 확정 전 점검(`confirm-check.ts`)의 식사 판정
 * (`itemType.code === 'MEAL'`)이 음식점을 담은 날을 "식사 없음" 으로 잘못 묻지 않는다.
 *
 * **카페는 `PLACE` 다.** 원천상 `RESTAURANT` 이지만(`isCafePlace`) 끼니가 아니다 — 카페만 담은 날은
 * 식사를 물어야 맞다. 판정은 `isCafePlace` 하나를 쓴다(목록 · 지도 핀과 같은 판정).
 *
 * `MEAL` 의 저장 계약은 `PLACE` 와 같다 — `targetId` 는 `place.id` 이고 서버가 같은 검증을 한다
 * (`PlanItemRequest.targetId` · `verifyPlaceTargets`).
 */
export function placeItemTypeOf(place: {
  contentType: { code: string }
  sourceCategory: string | null
}): AddedPlaceItemType {
  return place.contentType.code === 'RESTAURANT' && !isCafePlace(place) ? 'MEAL' : 'PLACE'
}

/**
 * 그 일자에 장소 하나를 담은 일괄 교체 본문 — **끝에 붙은 숙박 앞, 없으면 맨 끝** (#1175).
 *
 * **새 API 가 없다.** 담기도 일자 편집과 같은 `PUT …/days/{day}/items` 라, 기존 항목을
 * 전부 되싣고 하나를 더한 목록을 보낸다 — 되싣지 않으면 그 일자가 새 항목 하나만
 * 남기고 비워진다 (E1).
 *
 * `itemType` 은 **호출부가 `placeItemTypeOf` 로 판정해 넘긴다** (#1447) — 음식점은 `MEAL`, 나머지는
 * `PLACE` 다. 예전(#1175)에는 `PLACE` 고정이라 음식점을 담은 날도 확정 전 점검이 "식사 없음" 을 냈다
 * (일정상세 D26-5). **`WALK` 담기는
 * 이 함수를 쓰지 않는다** — [#382](https://github.com/8llow8llowMe/hondigagae/issues/382)로
 * `walk_course` 조회 API 가 생겨 더 이상 막힌 것이 아니고, `appendWalkCourseItemPayload`
 * (아래)가 자매 함수로 따로 있다 — 중복 판정(`placeIdsOf` vs `walkCourseIdsOf`)과 `title`
 * 조립 규칙이 갈려 인자로 합치지 않았다 (`올레담기-세부명세.md` D3-1).
 *
 * 위치를 고르는 UI 는 두지 않는다 — 순서는 편집모드가 소유한다(F5-3). 자리는 `itemInsertIndex`
 * 하나가 정한다 — 예전에는 늘 맨 끝이라 숙박 뒤에 붙었다.
 */
export function appendPlaceItemPayload(
  items: PlanItemDetail[],
  day: number,
  place: AddedPlace,
): PlanDayItemsReplacePayload {
  return insertItemPayload(items, day, {
    itemType: place.itemType,
    // 문자열 그대로다 — Snowflake 라 Number() 를 거치면 정밀도를 잃는다 (E1 규칙 1)
    targetId: place.placeId,
    title: place.title.slice(0, ITEM_TITLE_MAX),
  })
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
 * 그 일자에 산책 코스 하나를 담은 일괄 교체 본문 — 자리는 장소 담기와 같다(**끝에 붙은 숙박 앞**,
 * `itemInsertIndex`, #1175). `appendPlaceItemPayload` 의 자매다 (`올레담기-세부명세.md` D3).
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
  return insertItemPayload(items, day, {
    itemType: 'WALK',
    // 문자열 그대로다 — Snowflake 라 Number() 를 거치면 정밀도를 잃는다 (E1 규칙 1)
    targetId: course.walkCourseId,
    title: course.title.slice(0, ITEM_TITLE_MAX),
  })
}

// ─── 이동·휴식 직접 추가 (#1014) ──────────────────────────────────────────────

/**
 * 그 일자의 **맨 끝에** 이동·휴식(`MOVE`) 항목 하나를 붙인 일괄 교체 본문.
 * `appendPlaceItemPayload` 의 자매다 (`일자편집-세부명세.md` H1).
 *
 * **새 API 가 없다.** 담기와 같은 `PUT …/days/{day}/items` 라 기존 항목을 전부 되싣고
 * 하나를 더한다 — 되싣지 않으면 그 일자가 새 항목 하나만 남기고 비워진다 (E1).
 *
 * **`targetId` 키를 넣지 않는다.** 서버 계약이 "`MOVE` 는 비워 둡니다" 이고
 * (`PlanItemRequest.targetId`), 장소 검증은 `targetId` 가 없는 항목을 묻지 않는다
 * (`PlanCommandProcessor.verifyPlaceTargets`). `null` 을 실어도 뜻은 같지만 되싣는 쪽
 * (`toPayloadItem`)이 키를 빼므로 **한 본문 안에서 두 모양을 섞지 않는다.**
 *
 * **`title` 은 앞뒤 공백을 걷고 100자로 자른다.** 사용자가 쓴 글이라 넘치면 잘라 보내지
 * 않고 모달이 먼저 막는다(`validateMoveTitle`) — 여기서 자르는 것은 그 검증을 거치지 않은
 * 호출에 대한 2차 방어다. 서버는 자르지 않고 `PLAN_110` 을 낸다.
 *
 * 순서는 **맨 끝**이다. 위치를 고르는 UI 는 두지 않는다 — 순서는 편집모드가 소유한다
 * (F5-3 과 같은 판단).
 */
export function appendMoveItemPayload(
  items: PlanItemDetail[],
  day: number,
  move: { title: string },
): PlanDayItemsReplacePayload {
  const existing = items.map((item, index) => toPayloadItem(item, day, index))

  return {
    items: [
      ...existing,
      {
        day,
        sequence: existing.length,
        itemType: 'MOVE',
        // 비우면 기본 제목이다 (#1026) — 서버 `@NotBlank` 라 빈 값은 보낼 수 없다
        title: (move.title.trim() || messages.plan.addMoveDefaultTitle).slice(0, ITEM_TITLE_MAX),
      },
    ],
  }
}

/**
 * 이동·휴식 제목 검증. 통과하면 `null`, 아니면 필드에 붙일 문구.
 *
 * 서버 `PlanItemRequest.title` 의 `@Size(max = 100)`(`PLAN_110`) 복제본이다
 * (`form-guide.md` §5). **빈 값·공백만은 막지 않는다** (#1026) — `appendMoveItemPayload` 가
 * 기본 제목(`이동 및 휴식`)으로 채워 서버 `@NotBlank` 에 닿지 않는다.
 *
 * **길이는 걷어낸 값으로 잰다.** 보내는 것이 걷어낸 값이라(`appendMoveItemPayload`) 앞뒤
 * 공백 때문에 101자가 된 입력을 막으면 서버가 받을 값을 화면이 거절하게 된다.
 */
export function validateMoveTitle(value: string): string | null {
  if (value.trim().length > ITEM_TITLE_MAX) return messages.plan.addMoveTitleTooLong
  return null
}
