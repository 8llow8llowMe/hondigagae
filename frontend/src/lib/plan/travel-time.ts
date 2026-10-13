import { travelMinutes } from '@/lib/ai-plan/draft-schedule'
import { formatDuration } from '@/lib/format/duration'

/**
 * 항목 사이 예상 이동 시간 (`30분` · `1시간 40분`) — 이슈 #1426 · 일정상세-세부명세 D27-3.
 *
 * **규칙을 새로 두지 않는다.** AI 초안 담기가 시각을 이을 때 쓰는 근사(`travelMinutes` —
 * 직선 × 1.3 ÷ 40km/h, 10분 올림, 최소 10분, D25-2)를 그대로 쓴다. 두 곳이 다른 값을 말하면
 * 담긴 시각 간격과 행의 이동 시간이 어긋나 둘 다 못 믿게 된다.
 *
 * **어림값이다** — 문구가 `약` 을 붙인다(`messages.plan.distanceFromPrevious`). 직선거리 기반이라
 * 산간 · 해안도로를 다 반영하지 못한다.
 */
export function travelDurationLabel(meters: number): string {
  return formatDuration(travelMinutes(meters))
}
