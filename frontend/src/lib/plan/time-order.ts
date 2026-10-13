import { toClockTime } from '@/lib/plan/clock-time'
import { formatStartTime } from '@/lib/plan/start-time'

/**
 * 일정 항목 시각의 **역행 · 겹침** — 이슈 #1424.
 *
 * 2026-10-13 사용성 테스트에서 순서 편집 뒤 시각이 `10:00 → 15:00 → 12:30 → 15:00` 이 됐고, 경고
 * 없이 확정까지 됐다. 순서 편집은 시각을 고치지 않고 서버 원문을 되싣기 때문이다(#1028 · G0).
 *
 * **판정만 한다.** 시각을 고치는 것은 사용자다 — 일정 상세는 경고 칩을, 순서 편집 저장은 "다시
 * 맞출까요?" 를 낸다. 자동으로 덮어쓰지 않는다. 브리핑(#1425)도 같은 판정을 쓴다.
 *
 * **입력은 서버 원문 `startTime` 배열(그날 순서대로)** 이다. 형식이 어긋난 값은 시각이 없는 것으로
 * 본다 — 정규화는 `formatStartTime()` 하나가 전담한다 (D14-3).
 */

/**
 * - `backward` — 앞 항목보다 이르다 (역행)
 * - `overlap` — 앞 항목과 시각이 같다 (겹침). 머무는 시간은 모르므로 **같은 시각만** 겹침이다 —
 *   "앞 일정이 아직 안 끝났다" 는 화면이 지어낼 수 없는 판단이다
 */
export type TimeOrderIssue = 'backward' | 'overlap'

function toMinutes(value: string | null): number | null {
  const time = toClockTime(value)
  return time === null ? null : time.hour * 60 + time.minute
}

/**
 * 항목마다 판정한다. 입력과 같은 길이 · 같은 순서이고, 시각이 없거나 문제가 없으면 `null` 이다.
 *
 * - **역행은 시각이 있는 가장 가까운 앞 항목하고만 견준다** — 첫 항목과 견주면 한 항목이
 *   역행했을 때 그 뒤가 줄줄이 경고를 받는다. 고쳐야 할 자리는 어긋난 그 한 곳이다
 * - **겹침은 앞 항목 전부와 견준다** — 재현(`10:00 → 15:00 → 12:30 → 15:00`)의 마지막 숙소
 *   15:00 은 바로 앞(12:30)보다 늦지만 두 칸 앞 15:00 과 같은 시각이다
 * - 둘 다면 역행이다 — 순서를 고치면 겹침도 다시 보인다
 */
export function timeOrderIssues(startTimes: readonly (string | null)[]): (TimeOrderIssue | null)[] {
  let previous: number | null = null
  const seen = new Set<number>()

  return startTimes.map((value) => {
    const minutes = toMinutes(value)
    if (minutes === null) return null

    let issue: TimeOrderIssue | null = null
    if (previous !== null && minutes < previous) issue = 'backward'
    else if (seen.has(minutes)) issue = 'overlap'

    previous = minutes
    seen.add(minutes)
    return issue
  })
}

/**
 * 역행이 있는가 — 순서 편집 저장 전에 "시각도 다시 맞출까요?" 를 물을지.
 *
 * **겹침만으로는 묻지 않는다.** 다시 맞추는 것은 있던 시각을 순서대로 나눠 주는 일이라
 * 같은 시각 둘은 그대로 남는다 — 물어도 풀어 줄 것이 없다. 겹침은 일정 상세 경고 칩이 말한다.
 */
export function hasBackwardTime(startTimes: readonly (string | null)[]): boolean {
  return timeOrderIssues(startTimes).includes('backward')
}

/**
 * 시각이 있는 항목만 순서대로 `HH:mm` 을 ` → ` 로 잇는다 — 순서 편집 확인 문구가 "무엇이
 * 거꾸로인지" 를 보여 주는 데 쓴다 (#1424). 시각이 없는 항목은 건너뛴다.
 */
export function startTimesLine(startTimes: readonly (string | null)[]): string {
  return startTimes
    .map((value) => formatStartTime(value))
    .filter((value): value is string => value !== null)
    .join(' → ')
}

/**
 * 시각을 순서에 맞게 다시 나눈다 — **있던 시각을 오름차순으로 정렬해 시각이 있던 자리에 차례로
 * 둔다.**
 *
 * **새 시각을 지어내지 않는다.** 사용자가 적었거나 담기가 채운 값만 자리를 바꾼다 — 간격을
 * 계산해 채우면 "머무는 시간" 을 화면이 정하게 된다(`initialClockTime` D24-3 과 같은 판단).
 * 시각이 없던 자리는 그대로 비고, 형식이 어긋난 원문은 제자리에 둔다(지우지 않는다).
 */
export function realignedStartTimes(startTimes: readonly (string | null)[]): (string | null)[] {
  const valid = startTimes
    .filter((value): value is string => toMinutes(value) !== null)
    .sort((left, right) => (toMinutes(left) ?? 0) - (toMinutes(right) ?? 0))

  let cursor = 0
  return startTimes.map((value) => {
    if (toMinutes(value) === null) return value

    const next = valid[cursor] ?? value
    cursor += 1
    return next
  })
}
