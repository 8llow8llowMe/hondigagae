import { placeItemTypeOf } from '@/lib/plan/day-items'
import { formatStartTime } from '@/lib/plan/start-time'
import { timeOrderIssues } from '@/lib/plan/time-order'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 확정 전 점검 — 이슈 #1425 · 명세 D26-1.
 *
 * 2026-10-13 dev 사용성 테스트에서 시각이 겹친 일정, 식사가 0건인 날이 있는 일정이 경고 없이
 * 확정됐다. `일정 확정하기` 를 누르면 이 판정이 비지 않을 때만 점검 시트가 선다 — 비면 지금처럼
 * 바로 확정한다(확정은 되돌릴 수 있어 확인 대화상자를 두지 않는다, D11-2).
 *
 * **판정만 한다.** 고치는 것은 사용자다 — 시트가 그 일자로 보낸다.
 */

/**
 * - `backward` · `overlap` — D25-4 `timeOrderIssues` 그대로. 일정 상세의 경고 칩과 같은 행이다
 * - `no-time` — 시각이 없거나 형식이 어긋난 항목 (`MOVE` 는 제외)
 * - `no-meal` — 그날 돌아다니는 일정은 있는데 식사가 없다
 */
export type PlanConfirmIssue =
  | { kind: 'backward' | 'overlap'; planItemId: string; title: string; time: string }
  | { kind: 'no-time'; planItemId: string; title: string }
  | { kind: 'no-meal' }

export type PlanConfirmCheckDay = { day: number; issues: PlanConfirmIssue[] }

type CheckedItem = Pick<PlanItemDetail, 'planItemId' | 'itemType' | 'title' | 'startTime' | 'place'>

/**
 * **`MOVE` 의 빈 시각은 문제가 아니다.** `이동·휴식 추가` 는 시각을 받지 않는다
 * (`appendMoveItemPayload`) — 앞뒤 일정 사이에 끼는 항목이라 비어 있는 것이 정상이고, 세면
 * 이동을 담은 일정은 늘 시트를 본다. 시각이 **있으면** 역행 · 겹침은 다른 항목처럼 본다.
 */
const TIME_OPTIONAL_TYPES: ReadonlySet<string> = new Set(['MOVE'])

/**
 * 식사를 물을 날 — 이 유형이 하나라도 있는 날이다. **빈 날 · 숙박/이동만 있는 날은 묻지 않는다** —
 * 빈 날은 끼니를 잊은 날이 아니라 아직 짜지 않은 날이고, 저녁에 도착해 숙소만 담은 날에 끼니를
 * 요구하지 않는다.
 */
const OUTING_TYPES: ReadonlySet<string> = new Set(['PLACE', 'MEAL', 'WALK'])

/**
 * 식사 판정은 **`itemType.code`** 로 한다. 한국어 `name` 으로 가르지 않는다 (api-integration-guide §6).
 *
 * 담기는 음식점을 `MEAL` 로 싣는다 (`placeItemTypeOf` · `appendPlaceItemPayload`, #1447 · 명세 D26-5).
 * 그 전에 담겼거나 유형을 모른 채 담긴 음식점은 `PLACE` 로 남아 있다 — **`PLACE` 는 장소 요약의
 * `contentType` 으로 담기와 같은 판정(`placeItemTypeOf`)을 다시 내 센다** (#1516). 유형이 null 이거나
 * 장소가 없으면(delisted) 세지 않는다.
 */
const MEAL_TYPE = 'MEAL'

function isMealItem(item: CheckedItem): boolean {
  const code = item.itemType.code
  if (code === MEAL_TYPE) return true
  if (code !== 'PLACE' || item.place === null) return false
  // 이름 어림(`isCafeLikePlace`)은 항목 제목으로 본다 — 담을 때 장소명을 복사한 값이다
  return placeItemTypeOf({ ...item.place, title: item.title }) === MEAL_TYPE
}

function checkDay(items: readonly CheckedItem[]): PlanConfirmIssue[] {
  const order = timeOrderIssues(items.map((item) => item.startTime))
  const issues: PlanConfirmIssue[] = []

  // 항목 순서대로 — 줄 순서가 일자 카드의 순서와 같아야 고치러 가서 찾는다
  items.forEach((item, index) => {
    const time = formatStartTime(item.startTime)
    const timeIssue = order[index] ?? null

    if (time === null) {
      if (!TIME_OPTIONAL_TYPES.has(item.itemType.code)) {
        issues.push({ kind: 'no-time', planItemId: item.planItemId, title: item.title })
      }
      return
    }
    if (timeIssue !== null) {
      issues.push({ kind: timeIssue, planItemId: item.planItemId, title: item.title, time })
    }
  })

  const codes = items.map((item) => item.itemType.code)
  if (codes.some((code) => OUTING_TYPES.has(code)) && !items.some(isMealItem)) {
    issues.push({ kind: 'no-meal' })
  }

  return issues
}

/**
 * 문제가 있는 일자만, 일자 오름차순. **빈 배열이면 확정 전에 물을 것이 없다.**
 *
 * 입력은 `groupItemsByDay` 의 `days` 다 — **기간 밖 항목은 넣지 않는다.** 어느 일자에도 속하지
 * 않아 고치러 갈 곳이 없고, 기간 밖 카드가 따로 말한다.
 */
export function planConfirmCheck(
  days: readonly { day: number; items: readonly CheckedItem[] }[],
): PlanConfirmCheckDay[] {
  return days
    .map((group) => ({ day: group.day, issues: checkDay(group.items) }))
    .filter((group) => group.issues.length > 0)
    .sort((left, right) => left.day - right.day)
}
