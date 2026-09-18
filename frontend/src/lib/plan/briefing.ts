import { parseDay } from '@/lib/date/day'
import { addPlanDays } from '@/lib/plan/date'

/**
 * 출발 전 여행 브리핑이 부를 날짜 (#626 · 명세 D3-1).
 *
 * `GET /plans/{planId}/briefing` 의 `date` 는 **필수 쿼리 파라미터**다
 * (`@RequestParam LocalDate date`). 서버는 기본값을 주지 않고 기간 밖이면 `PLAN_002`
 * **400** 이라, **부를 날짜를 화면이 정하고 정할 수 없으면 아예 부르지 않는다.**
 */
export type BriefingTarget =
  /** 오늘이 여행 기간 안 — 오늘을 본다 */
  | { kind: 'TODAY'; date: string }
  /** 오늘이 출발 하루 전 — 시작일을 본다 */
  | { kind: 'EVE'; date: string }

/**
 * | # | 조건 | 결과 |
 * |---|------|------|
 * | 1 | 못 읽는 값이 있다 | `null` |
 * | 2 | `endDate < startDate` (역전 데이터) | `null` |
 * | 3 | `startDate <= today <= endDate` | `TODAY` |
 * | 4 | `today === startDate 의 하루 전` | `EVE` |
 * | 5 | 그 밖 (출발 이틀 전 이상 · 종료 후) | `null` |
 *
 * **날짜 비교는 문자열로 한다.** `YYYY-MM-DD` 는 사전순 = 시간순이다 (`isDayBefore` 주석).
 * 유효성만 `parseDay()` 로 보고 "하루 전" 은 `addPlanDays(startDate, -1)` 로 만든다 —
 * `Date` 로 로컬 산술을 하면 월 경계에서 타임존에 따라 하루 밀린다.
 *
 * **3번이 4번보다 먼저다.** 여행 2일차 아침에 여는 사람에게 1일차 브리핑을 주면 안 된다.
 *
 * **`planPhaseOf()` 를 쓰지 않는다.** 저쪽은 `D-DAY` 배지를 위해 **출발 당일을 `upcoming`**
 * 에 남기는 축이라(`lib/plan/date.ts` 주석) 여기서 쓰면 당일이 "아직 안 갔다" 쪽으로
 * 떨어진다. 질문이 다르면 함수도 다르다.
 *
 * **상태(`DRAFT`/`CONFIRMED`/`COMPLETED`)로 가르지 않는다.** 서버가 상태를 보지 않고
 * (`PlanWebFacade.getPlanBriefing` → `getOwnedPlan` 뿐), `COMPLETED` 로 가는 자동 전이도
 * 없다 (`screen-inventory.md` §4). 날짜 축 하나로만 판정한다.
 *
 * **여기서 고른 `date` 를 "오늘" 이라고 단정하지 않는다.** 서버는
 * `date.equals(LocalDate.now(clock))` 로 자기 시계를 보므로 자정 전후에는 `kind` 와 응답의
 * `today` 가 갈릴 수 있다 — 화면에 쓰는 것은 언제나 **응답의 `today`·`date`·`day`** 이고
 * `kind` 는 진입 배너 문구를 고르는 데에만 쓴다.
 *
 * @param today `todayDay(서버가 만든 Date)` 가 준 `YYYY-MM-DD`
 */
export function pickBriefingDate(
  startDate: string,
  endDate: string,
  today: string,
): BriefingTarget | null {
  if (parseDay(startDate) === null || parseDay(endDate) === null || parseDay(today) === null) {
    return null
  }

  // 역전 데이터는 기간이 성립하지 않는다 — 부를 날짜를 고르지 않는다
  if (endDate < startDate) return null

  if (startDate <= today && today <= endDate) return { kind: 'TODAY', date: today }

  const eve = addPlanDays(startDate, -1)
  if (eve !== null && today === eve) return { kind: 'EVE', date: startDate }

  return null
}
