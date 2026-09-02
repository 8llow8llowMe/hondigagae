import type { AiPlanDraft, AiPlanRequestSnapshot, AiPlanScheduleItem } from '@/types/ai-plan'

/**
 * 출처: backend ai-service `AiPlanScheduleItem` · `AiPlanDayItem` · `AiPlanDraftResponse` ·
 * `AiPlanPresenter` 코드 실측 — `origin/develop` `af86c98`.
 * 백엔드 기동 후 Swagger 로 재확인한다 (#67).
 *
 * **`title`·`note` 의 기본값을 문자열로 두되 null 변형을 함께 노출한다.** DTO 에 제약이
 * 없고 presenter 도 방어하지 않아 실제로 null 이 올 수 있다 — fixture 가 항상 문자열을
 * 채우면 화면이 `.trim()` 을 바로 부르는 버그를 테스트가 영원히 못 잡는다
 * (`testing-guide.md` §5).
 */
export function aiPlanItem(overrides: Partial<AiPlanScheduleItem> = {}): AiPlanScheduleItem {
  return {
    itemType: 'PLACE',
    placeId: '212481712381923328',
    title: '제주특별자치도립김창열미술관',
    note: '오전이라 노면이 덜 뜨거워요.',
    ...overrides,
  }
}

/** `title`·`note` 가 통째로 null 인 항목 — 서버가 실제로 낼 수 있는 모양이다 */
export function aiPlanItemWithNulls(
  overrides: Partial<AiPlanScheduleItem> = {},
): AiPlanScheduleItem {
  return aiPlanItem({ title: null, note: null, ...overrides })
}

export function aiPlanDraft(days: AiPlanDraft['days'], reasons: AiPlanDraft['reasons'] = []) {
  return { days, reasons } satisfies AiPlanDraft
}

export const aiPlanSnapshot: AiPlanRequestSnapshot = {
  areaCode: '39',
  startDate: '2026-09-12',
  endDate: '2026-09-14',
  pets: [{ petId: '123456789012000001', name: '몽실이' }],
  budget: 300_000,
  requestNote: '실내 위주로',
}
