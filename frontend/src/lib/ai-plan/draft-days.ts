import type { AiPlanDayItem, AiPlanDraft } from '@/types/ai-plan'

/**
 * 방문 항목 유형 — 장소 · 식사.
 *
 * **백엔드 `OllamaLlmAdapter.hasVisitItem` 과 같은 기준이다** (#1268). 서버가 이 기준으로
 * "전부 빈 초안" 을 `AIPLAN_022` 로 실패시키고 "일부만 빈 초안" 은 `COMPLETED` 로 내린다 —
 * 화면이 다른 기준으로 세면 서버가 완료로 보낸 초안을 화면이 빈 초안이라 부르거나 그 반대가
 * 된다. 숙소(`LODGING`)만 있는 날은 일정이 아니다.
 */
const VISIT_ITEM_TYPES: readonly string[] = ['PLACE', 'MEAL']

/** 이 날에 방문 항목이 하나라도 있는가 (#1270) */
export function isVisitDay(dayItem: AiPlanDayItem): boolean {
  return dayItem.items.some((item) => VISIT_ITEM_TYPES.includes(item.itemType))
}

export type DraftDayCoverage = {
  /** 방문 항목이 있는 일차 수. **`days.length` 가 아니다** */
  made: number
  /** 여행 총 일수. 기간을 모르면 null */
  total: number | null
  /**
   * "N일 중 M일만 만들었어요" 를 말할 수 있는가. **기간을 알 때만** 참이다 (명세 S6) —
   * `days.length` 는 응답이 빠뜨린 날을 모르므로 N 을 지어낼 수 없다.
   */
  partial: boolean
}

/**
 * 초안이 실제로 채운 날을 센다 (#1270).
 *
 * 예전에는 `draft.days.length` 로 셌다. dev job `e0f1fd25…` 처럼 **세 날 모두 `items: []`**
 * 로 온 초안이 "3일 중 3일" 이 되어 빈 상태로 가지 않고 제목뿐인 카드 셋이 섰다.
 *
 * - **기간 밖 일차는 세지 않는다** — 담기(`toDraftItems`)가 버리는 날이다
 * - **같은 일차가 둘이면 한 날이다** — 수가 기간을 넘어 부분 생성이 거꾸로 읽히지 않게
 * - 응답에서 **빠진 날**도 `made` 를 줄여 부분 생성 배너가 말한다
 *
 * 어느 카드가 빈 날인지는 카드가 `isVisitDay` 로 스스로 가린다.
 */
export function draftDayCoverage(draft: AiPlanDraft, totalDays: number | null): DraftDayCoverage {
  const madeDays = new Set<number>()

  for (const dayItem of draft.days) {
    if (totalDays !== null && (dayItem.day < 1 || dayItem.day > totalDays)) continue
    if (isVisitDay(dayItem)) madeDays.add(dayItem.day)
  }

  const made = madeDays.size

  return {
    made,
    total: totalDays,
    partial: totalDays !== null && made > 0 && made < totalDays,
  }
}
