import type { AiPlanSubmitPayload } from '@/types/ai-plan'
import type { PlanDetail } from '@/types/plan'

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
