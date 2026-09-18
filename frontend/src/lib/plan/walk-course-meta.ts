import { formatCourseDistance } from '@/lib/format/distance'
import type { PlanItemWalkCourse } from '@/types/plan'

/**
 * `WALK` 항목 행의 메타 줄 — `시흥-광치기 · 15.1km · 4~5시간` (일정상세-세부명세 D12-4).
 *
 * `placeMetaLine` 과 **같은 모양**이다. 조각이 없으면 낱말이 빠지고, 전부 없으면 `null` 을
 * 돌려 호출부가 줄 자체를 렌더하지 않는다.
 *
 * **`durationText` 를 파싱하지 않는다.** `4~5시간` 원문을 그대로 쓴다. `durationMaxMinutes`
 * 를 분 단위로 환산해 보여 주지 않는다 — 그 값은 `null` 이 "제한 없음" 이 아니라 "원문
 * 파싱 실패" 라서, 화면 숫자로 삼으면 모르는 코스가 "0분" 이나 빈칸으로 나간다.
 *
 * **거리 단위 `km` 를 반드시 붙인다.** 바로 아래 `PlanItemDistance` 의 이동 직선거리와
 * 다른 값이라 단위 없이 숫자만 두면 구분되지 않는다.
 *
 * **인자가 `null`(요약이 오지 않음)이면 `null` 이다.** `WALK` 항목의 `walkCourse` 가 비는
 * 세 경로(코스 없음 · tour-service 장애 · 수기 정리) 모두 이 자리에서 같게 다뤄진다 —
 * 호출부가 원인을 구분하지 않는다 (D12-4-1).
 */
export function walkCourseMetaLine(walkCourse: PlanItemWalkCourse | null): string | null {
  if (walkCourse === null) return null

  const parts = [
    walkCourse.name,
    walkCourse.distanceKm === null ? null : formatCourseDistance(walkCourse.distanceKm),
    walkCourse.durationText,
  ].filter((part): part is string => part !== null && part !== '')

  return parts.length === 0 ? null : parts.join(' · ')
}
