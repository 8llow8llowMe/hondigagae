import { draftDayStartTimes } from '@/lib/ai-plan/draft-schedule'
import type { LatLng } from '@/lib/geo/coord'
import type {
  AiPlanDayItem,
  AiPlanDraft,
  AiPlanRequestSnapshot,
  AiPlanScheduleItem,
} from '@/types/ai-plan'
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

function isPlanItemType(value: string): value is PlanItemTypeCode {
  return (PLAN_ITEM_TYPES as readonly string[]).includes(value)
}

export type DraftToPlanOptions = {
  /**
   * 담는 작업의 `jobId`. **`sourceAiJobId` 로 그대로 싣는다** — 담기 멱등 키다 (#1041).
   * 같은 작업을 다시 담으면 서버가 먼저 담긴 일정을 200 으로 돌려준다.
   */
  jobId: string
  draft: AiPlanDraft
  snapshot: AiPlanRequestSnapshot
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
  /**
   * `placeId` → 좌표 (#1424). 시각을 이을 때 **직선거리 기반 이동 시간**에 쓴다. 출처는 미리보기가
   * 이미 받은 보강 결과(`useDraftPlaces` 의 `coords`)다 — 별도 조회를 만들지 않는다. 모르는 자리는
   * 이동 30분으로 잇는다 (`draft-schedule.ts`).
   */
  coords?: ReadonlyMap<string, LatLng>
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
 * | `startTime`       | **앞 시각 + 머무름 + 이동** (#1424) |
 *
 * **명세에 없던 두 가지를 여기서 막는다.** 초안의 `itemType`·`title` 은 LLM 산출물이
 * 그대로 흘러온 문자열인데 `PlanItemRequest` 는 `itemType` 을 `PlanItemType` **enum**
 * 으로 역직렬화하고 `title` 에 `@NotBlank` 를 건다. 항목 하나가 어긋나면 **저장 요청
 * 전체가 400** 이 되므로, 보낼 수 없는 항목은 담기 전에 걸러낸다.
 */
export function draftToPlanPayload({
  jobId,
  draft,
  snapshot,
  title,
  totalDays,
  excludedPlaceIds,
  coords,
}: DraftToPlanOptions): PlanCreatePayload {
  return {
    /*
      **동반한 아이를 전부 싣는다** (#152 · #174). 예전에는 `PlanCreateRequest.petId` 가
      단일이라 담기 직전에 사람이 한 마리를 골랐지만, 이제 서버가 `petIds` 를 받고
      **첫 번째를 대표로 삼는다** — 생성에서 고른 순서가 그대로 저장된다.

      `petId` 를 함께 보내지 않는다. 서버 `effectivePetIds()` 가 `petIds` 를 이기게 두므로
      무시될 값이고, 두 필드를 실으면 어느 쪽이 진짜인지 호출부마다 다시 묻게 된다.
    */
    petIds: snapshot.pets.map((pet) => pet.petId),
    areaCode: snapshot.areaCode,
    /*
      **고른 지역을 저장까지 옮긴다** (#251). 옮기지 않으면 "제주시만" 으로 만든 일정이
      담기는 순간 "지역 미지정" 이 되고, 사용자가 고른 조건이 화면에서 사라진다.
      계약에는 처음부터 있던 필드다 (`PlanCreateRequest.sigunguCode`).
    */
    ...(snapshot.sigunguCode === null || snapshot.sigunguCode === undefined
      ? {}
      : { sigunguCode: snapshot.sigunguCode }),
    title,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    ...(snapshot.budget === null ? {} : { budget: snapshot.budget }),
    items: toDraftItems(draft, totalDays ?? null, excludedPlaceIds, coords),
    /*
      **담기 멱등 키** (#1041 · 백엔드 #970). 이것이 없으면 다시 누름 · 새로고침 뒤 재시도 ·
      다른 기기에서 담기가 전부 새 일정을 만든다. `jobId` 는 서버가 준 UUID 그대로라
      가공하지 않는다 — 형식이 어긋나면 `PLAN_135` 400 이다.
    */
    sourceAiJobId: jobId,
  }
}

/**
 * 초안 → 항목 목록. **담기(`POST /plans`)와 하루 재생성(`PUT .../days/{day}/items`)이
 * 나눠 쓴다** (하루재생성-세부명세 R4-3) — 규칙이 두 벌이 되면 반드시 갈라진다.
 */
export function toDraftItems(
  draft: AiPlanDraft,
  totalDays: number | null,
  excludedPlaceIds?: ReadonlySet<string>,
  coords?: ReadonlyMap<string, LatLng>,
): PlanItemRequest[] {
  const items: PlanItemRequest[] = []

  for (const dayItem of draft.days) {
    /*
      **시각은 미리보기와 같은 함수로 잇는다** (#1432) — `scheduledDayItems` 가 거르기 · 시각 잇기를
      한 번에 한다. 기간 밖 일차면 `null` 이다.
    */
    const scheduled = scheduledDayItems(dayItem, totalDays, excludedPlaceIds, coords)
    if (scheduled === null) continue

    scheduled.forEach(({ entry, startTime }, sequence) => {
      items.push({
        day: dayItem.day,
        sequence,
        itemType: entry.itemType,
        /*
          **`placeId` 를 유형으로 가리지 않는다** (#252). 예전에는 `WALK` 만 `targetId` 를
          빼고 보냈다 — 초안의 `placeId` 는 `place.id` 인데 `PlanItemRequest.targetId` 는
          `WALK` 일 때 `walk_course.id` 라 아이디 공간이 어긋났기 때문이다(#89).

          BE 가 그 원인을 없앴다. 초안 스키마에서 `WALK` 를 빼고, 그럼에도 모델이 `WALK` 에
          장소를 실으면 `OllamaLlmAdapter.resolveItemType` 이 `PLACE` 로 바로잡는다 —
          **초안의 모든 `itemType` 은 `place.id` 를 `targetId` 로 받는 유형이다.**
        */
        ...(entry.placeId === null ? {} : { targetId: entry.placeId }),
        title: entry.title.slice(0, ITEM_TITLE_MAX),
        ...(entry.memo === '' ? {} : { memo: entry.memo }),
        ...withStartTime(startTime),
      })
    })
  }

  return items
}

type KeptDraftItem = {
  /** 그날 원본 배열에서의 자리 — 미리보기가 걸러진 목록의 시각을 원본 행에 되돌려 놓는다 (#1432) */
  sourceIndex: number
  itemType: PlanItemTypeCode
  placeId: string | null
  title: string
  memo: string
}

/**
 * 담기가 실제로 싣는 그날 항목 — 보낼 수 없는 항목(제목 없음 · 모르는 유형 · 제외한 장소)을 뺀다.
 * **시각 계산도 이 목록으로 한다** — 미리보기(#1432)가 같은 시각을 말하려면 같은 목록이어야 한다.
 */
export function keptDayItems(
  dayItems: readonly AiPlanScheduleItem[],
  excludedPlaceIds?: ReadonlySet<string>,
): KeptDraftItem[] {
  const kept: KeptDraftItem[] = []

  dayItems.forEach((item, sourceIndex) => {
    // **`title`/`note` 는 nullable 이다** — `.trim()` 을 바로 부르면 던진다
    const itemTitle = (item.title ?? '').trim()
    if (itemTitle === '') return
    if (!isPlanItemType(item.itemType)) return
    if (item.placeId !== null && excludedPlaceIds?.has(item.placeId) === true) return

    kept.push({
      sourceIndex,
      itemType: item.itemType,
      placeId: item.placeId,
      title: itemTitle,
      memo: (item.note ?? '').trim().slice(0, ITEM_MEMO_MAX),
    })
  })

  return kept
}

/**
 * 담기가 받아 주는 일차인가.
 *
 * - `@Min(1)` — 0 이나 음수를 보내면 그 항목 때문에 요청 전체가 400 이다
 * - `Plan.containsDay()` — 기간을 넘는 일차 하나가 `PLAN_002` 로 저장 전체를 막는다.
 *   기간을 모르면(`null`) 거르지 않는다
 */
function isSavableDay(day: number, totalDays: number | null): boolean {
  if (!Number.isInteger(day) || day < 1) return false
  return totalDays === null || day <= totalDays
}

type ScheduledDraftItem = { entry: KeptDraftItem; startTime: string | undefined }

/**
 * 그날 담기가 싣는 항목과 그 시각. **담기(`toDraftItems`)와 미리보기(`draftDayPreviewTimes`)가 이것
 * 하나를 쓴다** (#1432) — 둘이 따로 거르고 따로 이으면 "미리 본 시각" 과 "저장된 시각" 이 갈린다.
 * 담기가 받지 않는 일차면 `null` 이다.
 */
function scheduledDayItems(
  dayItem: AiPlanDayItem,
  totalDays: number | null,
  excludedPlaceIds: ReadonlySet<string> | undefined,
  coords: ReadonlyMap<string, LatLng> | undefined,
): ScheduledDraftItem[] | null {
  if (!isSavableDay(dayItem.day, totalDays)) return null

  /*
    **걸러낸 뒤에 시각을 잇는다.** 원본 인덱스로 이으면 제외된 항목 자리에 구멍이 생겨 화면 순서와
    저장 순서가 어긋나고, 빠진 장소까지의 이동 시간이 남는다. sequence 도 걸러낸 뒤 다시 매긴다.
  */
  const kept = keptDayItems(dayItem.items, excludedPlaceIds)

  /*
    **초안에는 시각이 없지만 비워 보내지 않는다** (#1383 · 일정상세-세부명세 D24). 비우면 항목 산책
    위험도가 `NO_START_TIME` 으로 꺼진다. 예전에는 순서 슬롯(10:00 · 12:30 · 15:00)이라 날마다 같은
    템플릿이었다 — 이제 **앞 시각 + 머무는 시간 + 직선거리 이동 시간**이다 (#1424). 20:00 을
    넘는 자리는 키를 뺀다.
  */
  const startTimes = draftDayStartTimes(
    kept.map((entry) => ({ itemType: entry.itemType, placeId: entry.placeId })),
    coords,
  )

  return kept.map((entry, index) => ({ entry, startTime: startTimes[index] }))
}

export type DraftDayPreviewOptions = {
  totalDays: number | null
  excludedPlaceIds?: ReadonlySet<string> | undefined
  coords?: ReadonlyMap<string, LatLng> | undefined
}

/**
 * 미리보기 행마다 **담으면 들어갈 시각** (서버 형식 `HH:mm:ss`) — #1432 · 공통명세 S11-1.
 *
 * 입력 `dayItem.items` 와 **같은 길이 · 같은 순서**로 돌려준다. 담기가 싣지 않는 행(빈 제목 · 모르는
 * 유형 · 빼기로 표시한 장소 · 기간 밖 일차)과 20:00 을 넘는 자리는 `undefined` 다 — 그 행에는 시각
 * 줄이 없다. 값은 `toDraftItems` 가 싣는 `startTime` 과 같다(같은 `scheduledDayItems` 를 쓴다).
 */
export function draftDayPreviewTimes(
  dayItem: AiPlanDayItem,
  { totalDays, excludedPlaceIds, coords }: DraftDayPreviewOptions,
): (string | undefined)[] {
  const times: (string | undefined)[] = dayItem.items.map(() => undefined)

  for (const { entry, startTime } of scheduledDayItems(
    dayItem,
    totalDays,
    excludedPlaceIds,
    coords,
  ) ?? []) {
    times[entry.sourceIndex] = startTime
  }

  return times
}

function withStartTime(startTime: string | undefined): { startTime?: string } {
  return startTime === undefined ? {} : { startTime }
}

/**
 * 초안이 담을 수 있는 장소 id 목록. `PLAN_004` 안내에서 "빼면 담을 수 있는 것" 을
 * 가리키는 데 쓴다.
 */
export function draftPlaceIds(draft: AiPlanDraft): string[] {
  const ids = new Set<string>()

  for (const dayItem of draft.days) {
    for (const item of dayItem.items) {
      if (item.placeId !== null) ids.add(item.placeId)
    }
  }

  return [...ids]
}

/** 초안 항목 총 개수 — 미리보기 요약줄의 `항목 6개` (아트보드 03) */
export function draftItemCount(draft: AiPlanDraft): number {
  return draft.days.reduce((total, dayItem) => total + dayItem.items.length, 0)
}
