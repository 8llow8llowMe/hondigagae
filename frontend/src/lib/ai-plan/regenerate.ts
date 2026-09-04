import { toDraftItems } from '@/lib/ai-plan/draft-to-plan'
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
