import { parseDay, weekdayOf } from '@/lib/date/day'

/**
 * 기간 혼잡도의 순수 규칙 (#430).
 *
 * **판정은 여기 없다.** "가장 덜 붐비는 날" 은 서버가 고르고(`leastCrowded`) FE 는 그것을
 * 그대로 쓴다 — 규칙(`UNKNOWN` 제외 최저 집중률, 동률이면 가장 이른 날짜)이 BE
 * `CongestionSnapshot` 한 곳에 있어야 같은 기간에 두 답이 나오지 않는다. 이 파일이 갖는
 * 것은 **그리기 위한 변환**뿐이다.
 */

/**
 * 조회 일수 — **화이트리스트다** (architecture-guide.md §10).
 *
 * 계약은 1~30 이지만 화면이 주는 선택지는 둘뿐이다. 범위로 열어 두면 `days=13` 같은 값이
 * 어디선가 새로 생기고, 그때 카드 머리의 기간 표기·레일 폭이 검증된 적 없는 상태가 된다.
 *
 * `extended` 가 30 인 이유는 **혼잡도 예측이 30일 rolling** 이기 때문이다 — 서버가 답할 수
 * 있는 끝까지다.
 */
export const CONGESTION_DAYS = {
  default: 7,
  extended: 30,
} as const

export type CongestionDays = (typeof CONGESTION_DAYS)[keyof typeof CONGESTION_DAYS]

/**
 * 막대 색 단계 — **네 칸이다** (#603).
 *
 * **hue 는 서버 등급이 정한다.** FE 가 집중률로 색을 처음부터 다시 나누면 배지가
 * `보통` 이라 말하는 날에 막대가 주황으로 서서 **한 카드 안에서 두 말이 갈린다.**
 *
 * 가르는 것은 `HIGH` 한 칸의 **안쪽뿐이다.** 등급이 셋인데 실데이터가 `HIGH` 에 몰려,
 * 30일을 펼치면 막대가 회색 한 덩어리로 깔렸다 — 색이 있으나 아무것도 구별해 주지 않는
 * 상태다. 같은 `혼잡` 안에서 70 인 날과 92 인 날은 사용자에게 다른 날이다.
 */
export type CongestionFill = 'low' | 'moderate' | 'busy' | 'packed' | 'unknown'

/**
 * `HIGH` 를 둘로 가르는 집중률.
 *
 * **서버 등급 경계가 아니다.** 등급은 서버가 주고 이 값은 그 안을 다시 나누기만 하므로,
 * 여기를 바꿔도 배지 문구(`level.name`)와 어긋나지 않는다. 80 인 이유는 dev 실데이터에서
 * `HIGH` 가 대략 60~95 에 퍼져 있어 그 한가운데 위라 양쪽에 날이 고르게 남아서다.
 */
export const PACKED_RATE = 80

/**
 * 등급 코드 + 집중률 → 막대 색 단계.
 *
 * **집중률을 모르면 `HIGH` 라도 `busy` 다** — 둘로 가를 근거가 없는데 더 붉게 칠하면
 * 모르는 것을 아는 것처럼 말하게 된다.
 */
export function congestionFill(
  code: string | null | undefined,
  concentrationRate: number | null,
): CongestionFill {
  switch (code) {
    case 'LOW':
      return 'low'
    case 'MODERATE':
      return 'moderate'
    case 'HIGH':
      return concentrationRate !== null && concentrationRate >= PACKED_RATE ? 'packed' : 'busy'
    default:
      return 'unknown'
  }
}

/**
 * 집중률 → 막대 높이(%). 트랙 전체가 **집중률 100** 이다.
 *
 * **기간 안 최댓값으로 정규화하지 않는다.** 그렇게 하면 전부 20 대인 한산한 주와 전부 80
 * 대인 성수기 주가 같은 그림이 되어, 사용자가 "이 주는 한산하다" 를 읽을 수 없다. 축이
 * 고정이라 다른 장소·다른 기간과도 눈으로 비교된다.
 *
 * **아는 값은 최소 4% 를 준다.** 집중률 0 도 실재하는 값인데(사람이 없는 날) 높이 0 이면
 * 막대가 사라져 `UNKNOWN`(막대 없음)과 화면에서 구별되지 않는다.
 */
export function barHeightPercent(concentrationRate: number): number {
  if (!Number.isFinite(concentrationRate)) return 4

  return Math.max(4, Math.min(100, concentrationRate))
}

/**
 * 카드 머리의 기간 표기 — `9.14 – 9.20`.
 *
 * **서버의 `fromDate` · `toDate` 를 쓴다.** `days` 로 계산하지 않는다 — 서버가 기간을
 * 자르면 표기만 늘어난 화면이 된다.
 *
 * 일정 화면의 `2026-09-12 (토) – 09-14 (월)`(`lib/plan/date.ts`)보다 짧은 형식인 것은
 * **자리가 다르기 때문이다.** 이쪽은 400px 레일 카드의 제목 오른쪽에 붙는 꼬리표이고,
 * 요일은 막대마다 이미 적혀 있다. 날짜를 못 읽으면 `null` 이라 호출부가 줄을 내지 않는다.
 */
export function formatCongestionRange(fromDate: string, toDate: string): string | null {
  const from = formatMonthDay(fromDate)
  const to = formatMonthDay(toDate)
  if (from === null || to === null) return null

  return from === to ? from : `${from} – ${to}`
}

function formatMonthDay(date: string): string | null {
  if (parseDay(date) === null) return null

  const [, month, day] = date.split('-') as [string, string, string]
  return `${Number(month)}.${Number(day)}`
}

/**
 * `yyyy-MM-dd` 를 화면이 쓰는 조각으로. 못 읽으면 `null`.
 *
 * **문구를 만들지 않는다** — 조각만 주고 배치는 `messages.place.*` 의 치환 문구가 한다.
 * 여기서 `9월 17일 (수)` 를 조립하면 화면 문구가 `lib/messages` 밖에도 생긴다.
 */
export function splitDay(date: string): { month: string; day: string; weekday: string } | null {
  const weekday = weekdayOf(date)
  if (weekday === null) return null

  const [, month, day] = date.split('-') as [string, string, string]
  return { month: String(Number(month)), day: String(Number(day)), weekday }
}
