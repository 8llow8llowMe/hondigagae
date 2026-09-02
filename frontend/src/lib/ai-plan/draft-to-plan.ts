import type { AiPlanDraft, AiPlanRequestSnapshot } from '@/types/ai-plan'
import {
  PLAN_ITEM_TYPES,
  type PlanCreatePayload,
  type PlanItemRequest,
  type PlanItemTypeCode,
} from '@/types/plan'

/**
 * 초안 → `POST /plans` 요청 본문 (명세 S5).
 *
 * **AI 는 제안만 하고 저장·확정은 plan-service 가 한다.** "담기" 가 곧 `POST /plans` 다.
 *
 * 근거: backend plan-service `PlanCreateRequest` · `PlanItemRequest` · `PlanItemType`
 * **소스 실측** (`origin/develop` `af86c98`).
 */

/** 백엔드 `PlanItemRequest` 제약 */
const ITEM_TITLE_MAX = 100
const ITEM_MEMO_MAX = 500

/**
 * **`WALK` 은 `targetId` 를 보내지 않는다** (명세 S5 함정 2 · S8 미결 4).
 *
 * `AiPlanScheduleItem.placeId` 는 "장소 아이디" 인데 `PlanItemRequest.targetId` 는 `WALK`
 * 일 때 **`walk_course.id`** 다. 백엔드 검증(`PLACE_TARGET_TYPES`)이 `WALK` 를 빼기 때문에
 * **틀린 id 가 조용히 저장된다.** 보내지 않는 편이 낫다 — 이슈 #89 가 BE 쪽 문제다.
 */
const TARGET_ID_TYPES: readonly PlanItemTypeCode[] = ['PLACE', 'MEAL', 'LODGING']

function isPlanItemType(value: string): value is PlanItemTypeCode {
  return (PLAN_ITEM_TYPES as readonly string[]).includes(value)
}

export type DraftToPlanOptions = {
  draft: AiPlanDraft
  snapshot: AiPlanRequestSnapshot
  /**
   * 이 일정의 판정 기준이 될 반려견. **스냅샷에서 꺼내지 않고 받는다** —
   * `PlanCreateRequest.petId` 가 단일이라 여러 마리 중 하나를 사람이 고르고
   * (다견선택-세부명세 D4), 그 선택이 여기까지 그대로 와야 한다.
   */
  basisPetId: string
  title: string
  /**
   * 여행 총 일수. **기간 밖 일차를 걸러내는 데 쓴다** — 모르면(`null`) 거르지 않는다.
   *
   * `PlanCommandProcessor.createPlan` 이 `validateItemDays` → `Plan.containsDay()`
   * (`1 <= day <= totalDays`)로 검사하고 하나만 벗어나도 **`PLAN_002` 400 으로 저장
   * 전체가 막힌다.** LLM 이 기간을 넘는 일차를 낼 수 있고(`OllamaLlmAdapter.toDomain`
   * 은 클램프하지 않는다) 화면은 기간을 이미 알고 있으므로 여기서 막는다.
   */
  totalDays?: number | null
  /**
   * 담기에서 뺄 장소. `PLAN_004`(delisting 된 장소)로 저장이 막혔을 때 **초안을 버리지
   * 않고** 해당 항목만 빼고 다시 담기 위해 쓴다 (명세 S5 함정 3).
   */
  excludedPlaceIds?: ReadonlySet<string>
}

/**
 * 매핑 규칙 (명세 S5 표).
 *
 * | `PlanItemRequest` | 어디서                             |
 * | ----------------- | ---------------------------------- |
 * | `day`             | `AiPlanDayItem.day`                |
 * | `sequence`        | 그 일자 배열의 **인덱스** (0부터)  |
 * | `itemType`        | `itemType` 그대로                  |
 * | `targetId`        | `placeId` — **문자열로 보낸다**    |
 * | `title`           | `title` (100자 초과면 자른다)      |
 * | `memo`            | `note` (500자 초과면 자른다)       |
 * | `startTime`       | **보내지 않는다** (초안에 없다)    |
 *
 * **명세에 없던 두 가지를 여기서 막는다.** 초안의 `itemType`·`title` 은 LLM 산출물이
 * 그대로 흘러온 문자열인데 `PlanItemRequest` 는 `itemType` 을 `PlanItemType` **enum**
 * 으로 역직렬화하고 `title` 에 `@NotBlank` 를 건다. 항목 하나가 어긋나면 **저장 요청
 * 전체가 400** 이 되므로, 보낼 수 없는 항목은 담기 전에 걸러낸다.
 */
export function draftToPlanPayload({
  draft,
  snapshot,
  basisPetId,
  title,
  totalDays,
  excludedPlaceIds,
}: DraftToPlanOptions): PlanCreatePayload {
  return {
    petId: basisPetId,
    areaCode: snapshot.areaCode,
    title,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    ...(snapshot.budget === null ? {} : { budget: snapshot.budget }),
    items: toItems(draft, totalDays ?? null, excludedPlaceIds),
  }
}

function toItems(
  draft: AiPlanDraft,
  totalDays: number | null,
  excludedPlaceIds?: ReadonlySet<string>,
): PlanItemRequest[] {
  const items: PlanItemRequest[] = []

  for (const dayItem of draft.days) {
    // `@Min(1)` — 0 이나 음수를 보내면 그 항목 때문에 요청 전체가 400 이다
    if (!Number.isInteger(dayItem.day) || dayItem.day < 1) continue
    // `Plan.containsDay()` — 기간을 넘는 일차 하나가 `PLAN_002` 로 저장 전체를 막는다
    if (totalDays !== null && dayItem.day > totalDays) continue

    // **sequence 는 걸러낸 뒤 다시 매긴다.** 원본 인덱스를 쓰면 제외된 항목 자리에
    // 구멍이 생겨 화면 순서와 저장 순서가 어긋난다
    let sequence = 0

    for (const item of dayItem.items) {
      // **`title`/`note` 는 nullable 이다** — `.trim()` 을 바로 부르면 던진다
      const itemTitle = (item.title ?? '').trim()
      if (itemTitle === '') continue
      if (!isPlanItemType(item.itemType)) continue

      const placeId = item.placeId
      if (placeId !== null && excludedPlaceIds?.has(placeId) === true) continue

      const memo = (item.note ?? '').trim().slice(0, ITEM_MEMO_MAX)
      const targetId =
        placeId !== null && TARGET_ID_TYPES.includes(item.itemType) ? placeId : undefined

      items.push({
        day: dayItem.day,
        sequence,
        itemType: item.itemType,
        ...(targetId === undefined ? {} : { targetId }),
        title: itemTitle.slice(0, ITEM_TITLE_MAX),
        ...(memo === '' ? {} : { memo }),
      })

      sequence += 1
    }
  }

  return items
}

/**
 * 초안이 담을 수 있는 장소 id 목록. `PLAN_004` 안내에서 "빼면 담을 수 있는 것" 을
 * 가리키는 데 쓴다.
 */
export function draftPlaceIds(draft: AiPlanDraft): string[] {
  const ids = new Set<string>()

  for (const dayItem of draft.days) {
    for (const item of dayItem.items) {
      if (item.placeId !== null && TARGET_ID_TYPES.includes(item.itemType as PlanItemTypeCode)) {
        ids.add(item.placeId)
      }
    }
  }

  return [...ids]
}

/** 초안 항목 총 개수 — 미리보기 요약줄의 `항목 6개` (아트보드 03) */
export function draftItemCount(draft: AiPlanDraft): number {
  return draft.days.reduce((total, dayItem) => total + dayItem.items.length, 0)
}
