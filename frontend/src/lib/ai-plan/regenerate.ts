import { toDraftItems } from '@/lib/ai-plan/draft-to-plan'
import { isDayBefore, todayDay } from '@/lib/date/day'
import type { AiPlanDraft, AiPlanSubmitPayload } from '@/types/ai-plan'
import type { PlanDetail, PlanItemRequest } from '@/types/plan'

/**
 * 하루 재생성 (#128 · 하루재생성-세부명세).
 *
 * **새 API 를 만들지 않는다.** 생성과 같은 `POST /ai-plans` 에 `planId` + `regenerateDay`
 * 를 실으면 서버가 기존 일정 개요를 불러 그 날만 새로 짠다
 * (`AiPlanPromptFactory#appendRegenerateSection`).
 */

/**
 * 저장된 일정 → 재생성 제출 본문 (R3).
 *
 * **조건이 전부 일정에서 나온다.** 그래서 생성 경로와 달리 `sessionStorage` 스냅샷을
 * 쓰지 않는다 (R2-2) — 보관할 것이 없다.
 *
 * **`preferFavorites`·`pinnedPlaceIds` 를 싣지 않는다** (R3-1). 일정에 저장되지 않는
 * 값이라 되살릴 근거가 없고, `pinnedPlaceIds` 는 "반드시 배치" 약속이라 잘못 실으면
 * 사용자가 요구한 적 없는 장소가 그 날에 박힌다.
 *
 * @param day 1부터. 호출부가 `plan.totalDays` 안인지 이미 확인했다
 * @param requestNote 화면 입력. 길이는 textarea 의 `maxLength` 가 막는다 —
 *   `toAiPlanSubmitPayload` 와 같은 분담이라 여기서 자르지 않는다
 */
export function toDayRegeneratePayload(
  plan: PlanDetail,
  day: number,
  requestNote: string,
): AiPlanSubmitPayload {
  const note = requestNote.trim()
  // `@Positive` — 0 을 보내면 요청 전체가 400 이다
  const budget = plan.budget !== null && plan.budget > 0 ? plan.budget : null

  return {
    areaCode: plan.areaCode,
    startDate: plan.startDate,
    endDate: plan.endDate,
    petIds: plan.petIds,
    ...(budget === null ? {} : { budget }),
    ...(note === '' ? {} : { requestNote: note }),
    planId: plan.planId,
    regenerateDay: day,
  }
}

/**
 * 재생성 초안에서 **그 일자 하나만** 뽑는다 (R4).
 *
 * **초안은 모든 날을 담아 온다.** 프롬프트가 _"나머지 날은 기존 항목을 순서까지 그대로
 * 유지해 전체 일정을 출력할 것"_ 이라고 지시하기 때문이다. 그 지시는 **부탁이지 강제가
 * 아니다** — 이 저장소는 이미 LLM 산출물을 못 믿는 전제로 짜여 있다
 * (`draft-to-plan.ts` 가 기간 밖 일차를 걸러내는 것과 같은 판단).
 *
 * 다른 날을 반영하지 않는 이유는 둘이다. **사용자가 하루만 바꾸겠다고 말했고**,
 * 일자별 PUT 은 원자적이지 않아 여러 날을 쓰다 중간에 실패하면 반쯤 바뀐 일정이 남는다.
 *
 * @returns 목표 일자가 초안에 없으면 `null`. **빈 배열과 뜻이 다르다** —
 *   `PlanDayItemsReplacePayload` 는 빈 목록을 "그 일자 전부 삭제" 로 읽으므로
 *   재생성 실패를 조용한 삭제로 바꾸면 안 된다 (R4-2)
 */
export function toRegeneratedDayItems(
  draft: AiPlanDraft,
  day: number,
  totalDays: number,
  excludedPlaceIds?: ReadonlySet<string>,
): PlanItemRequest[] | null {
  const target = draft.days.find((entry) => entry.day === day)
  if (target === undefined) return null

  return toDraftItems({ days: [target], reasons: [] }, totalDays, excludedPlaceIds)
}

/**
 * AI 생성이 감당하는 여행 일수 상한.
 *
 * `AiPlanJobProcessor.MAX_TRIP_DAYS` = 10 (후보 풀 규모 · 예보 커버리지 약 11일).
 * **plan-service 는 30일까지 받는다** (`PlanCommandProcessor:32`) — 두 상한이 다르므로
 * 11~30일 일정은 저장은 되지만 AI 로 다시 만들 수 없다.
 */
export const AI_PLAN_MAX_TRIP_DAYS = 10

/** 재생성을 막는 이유. 서버 코드와 짝이다 — `AIPLAN_017` · `AIPLAN_018` */
export type DayRegenerateBlock = 'START_DATE_IN_PAST' | 'TRIP_DAYS_EXCEEDED'

/**
 * 하루 재생성을 아예 할 수 없는 일정인가 (R6).
 *
 * **제출이 두 전제를 조용히 물려받는다.** `POST /ai-plans` 는 `validateRegenerateRequest`
 * **앞에서** 시작일과 일수를 보고(`AiPlanJobProcessor:55-62`), 재생성 payload 는 저장된
 * 일정의 `startDate`/`endDate` 를 그대로 싣는다(`toDayRegeneratePayload`). 그래서
 * **이미 시작한 여행과 11일 이상 일정은 이 기능을 영원히 쓸 수 없다.**
 *
 * 이 판정이 없으면 화면은 누를 수는 있지만 늘 400 인 버튼을 내고, 사용자는 *하루만 다시
 * 만드는* 화면에서 `여행 시작일은 오늘 이후여야 합니다` 를 읽는다. **진입점과 뷰가 같은
 * 함수를 쓴다** — 한쪽만 고치면 주소를 손으로 넣어 들어온 사용자가 그 400 을 본다.
 *
 * **`today` 를 주입받는다** — 모듈 안에서 `new Date()` 를 부르면 서버 렌더와
 * 하이드레이션이 자정 근처에서 갈린다 (`lib/plan/date.ts` 와 같은 분담).
 *
 * 일수는 `totalDays` 로 센다. 서버가 같은 `startDate`~`endDate` 로 계산해 주는 값이라
 * (`PlanDetailResponse.totalDays`) payload 가 실어 보낼 기간과 같은 셈이다.
 *
 * @returns 막을 이유가 없으면 `null`. 날짜를 못 읽으면 막지 않는다 —
 *   판정할 근거가 없을 때 기능을 잠그는 편이 더 위험하다 (`isPastPlan` 과 같은 판단)
 */
export function dayRegenerateBlock(
  plan: Pick<PlanDetail, 'startDate' | 'totalDays'>,
  today: Date,
): DayRegenerateBlock | null {
  // 서버가 보는 순서를 따른다 — 둘 다 걸리면 시작일이 이긴다
  if (isDayBefore(plan.startDate, todayDay(today))) return 'START_DATE_IN_PAST'
  if (plan.totalDays > AI_PLAN_MAX_TRIP_DAYS) return 'TRIP_DAYS_EXCEEDED'

  return null
}
