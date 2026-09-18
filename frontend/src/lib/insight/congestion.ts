import { parseDay, weekdayOf } from '@/lib/date/day'
import type { DailyCongestionItem, PlaceCongestionResponse } from '@/types/insight'

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
 * `month` 가 30 인 이유는 **혼잡도 예측이 30일 rolling** 이기 때문이다 — 서버가 답할 수
 * 있는 끝까지다.
 */
export const CONGESTION_DAYS = {
  week: 7,
  month: 30,
} as const

export type CongestionDays = (typeof CONGESTION_DAYS)[keyof typeof CONGESTION_DAYS]

/**
 * 첫 화면이 보는 기간 — **30일이다** (#603).
 *
 * **폭에 따라 가르지 않는다.** "넓은 화면이면 30일" 이 자연스러워 보이지만 두 군데서 깨진다.
 *
 *  1. **30일은 어느 폭에서도 안 들어간다.** 칸 36 + 간격 6 이라 1254px 가 필요한데,
 *     그래프가 가장 넓어지는 1920 에서도 982px 라 23/30 만 선다. "넓으면 다 보인다" 가
 *     성립하지 않으므로 폭으로 가를 근거 자체가 없다.
 *  2. **넓은 뷰포트가 넓은 그래프를 뜻하지 않는다.** 1024 에서 2단이 시작되며 400px 판정
 *     레일이 자리를 가져가, 그래프가 768 의 692 에서 **560 으로 줄어든다.** 폭으로 가르면
 *     하필 가장 좁은 구간이 30일을 받는다.
 *
 * 게다가 서버는 뷰포트를 모른다 — SSR 이 7일로 그리고 하이드레이션 뒤 갈아타면 화면이
 * 튀고 조회가 두 번 나간다. 트리를 폭마다 나누는 방식은 스크린리더 중복 읽기 때문에 이
 * 저장소가 금지해 뒀다(`app/globals.css` 의 `.rail-layout-detail`).
 *
 * 그래서 폭과 무관하게 30일로 연다. 7일은 **좁히는 쪽** 선택지로 남는다 — 이 카드의 값은
 * "언제 갈까" 에 멀리까지 답하는 것이고, 화살표와 페이드가 더 있다는 것을 말해 준다.
 */
export const CONGESTION_DEFAULT_DAYS: CongestionDays = CONGESTION_DAYS.month

/** 아는 날이 하나라도 있는 기간 — 서버가 고른 날이 실물이다 */
export type CongestionWithAnswer = PlaceCongestionResponse & {
  leastCrowded: DailyCongestionItem
}

/**
 * **답이 있는 기간인가.** `isCongestionEmpty` 의 반대면이고, 타입을 좁히는 쪽이다.
 *
 * 화면이 `leastCrowded.date` 를 읽어야 하는데 타입에는 "비지 않았으면 실물" 이라는 관계가
 * 없다 — 여기서 한 번 좁혀 두면 호출부에 `!` 가 남지 않는다.
 */
export function hasCongestionAnswer(data: PlaceCongestionResponse): data is CongestionWithAnswer {
  return data.leastCrowded !== null
}

/**
 * **그릴 것이 하나도 없는 기간인가** (#731).
 *
 * `true` 면 화면이 차트(레일 · 막대 · 점선 격자 · 날짜 축)를 **아예 그리지 않고** 빈 상태
 * 블록 하나만 세운다. 카드 머리의 기간 표기도 이때는 내지 않는다 — 자료 0건인데 기간을
 * 제시하면 말과 화면이 어긋난다.
 *
 * **판정은 `leastCrowded === null` 이다.** 서버가 `UNKNOWN` 을 제외하고 최저 집중률을
 * 고르므로(`CongestionSnapshot`) 아는 날이 하나도 없을 때만 그 값이 `null` 이 된다 —
 * `dailyCongestions` 를 FE 가 다시 훑지 않는다.
 *
 * **`hasUnknown` 으로 바꾸지 않는다.** 아는 날이 하루라도 있으면 그 날이 답이고, 그쪽에서
 * 점선은 **여전히 옳은 기호**다: 31칸 중 한 칸만 점선이면 "아직 모르는 날" 이 또렷이 읽힌다.
 * 같은 기호가 30칸 전부에 깔릴 때만 신호가 잡음이 된다 — 그 경계가 이 함수다.
 *
 * 판정을 이 한 곳에 두는 이유는 **머리(기간 표기)와 본문(차트)이 같은 답을 봐야** 하기
 * 때문이다. 두 군데서 따로 재면 기간만 남은 카드가 생긴다.
 */
export function isCongestionEmpty(data: PlaceCongestionResponse): boolean {
  return !hasCongestionAnswer(data)
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
 * 집중률 줄이 말할 것 — 정수 값 · 같은 기간 평균 · 그 차이 (#651 · 진단 D-3).
 *
 * **왜 상대 표현인가.** `집중률 57.77` 은 높은 값인지 낮은 값인지 화면 어디에도 비교 기준이
 * 없다. 수월봉 30일 실측에서 그 값은 **평균보다 25 낮은 날**인데 화면은 그 사실을 말하지
 * 않았다. 소수 둘째 자리는 예측값의 정밀도를 실제보다 높게 보이게 한다.
 *
 * **`UNKNOWN` 을 평균에서 뺀다.** `concentrationRate` 가 `null` 인 날은 값이 없는 것이지
 * 0 이 아니다 — 넣으면 평균이 내려가 "평균보다 낮다" 가 과장된다.
 *
 * **"FE 가 다시 고르지 않는다" 규칙과 충돌하지 않는다.** 그 규칙이 막는 것은 서버의 답
 * (`leastCrowded`)을 FE 가 다시 정하는 것이다. 평균은 답이 아니라 **서버가 보낸 분포를
 * 그대로 요약한 값**이고, 어떤 날을 고르지도 바꾸지도 않는다.
 */
export type CongestionRateSummary = {
  /** 정수로 내린 집중률 */
  rate: number
  /** 같은 기간 아는 날들의 평균(정수). 낼 수 없으면 `null` */
  average: number | null
  /** 평균보다 얼마나 낮은가(정수, 양수). 비교할 것이 없거나 차이가 0 이면 `null` */
  belowAverage: number | null
}

export function congestionRateSummary(
  concentrationRate: number,
  items: DailyCongestionItem[],
): CongestionRateSummary {
  const rate = Math.round(concentrationRate)
  const known = items
    .map((item) => item.concentrationRate)
    .filter((value): value is number => value !== null && Number.isFinite(value))

  /*
    아는 날이 하나뿐이면 그 하나가 곧 평균이다 — "평균보다 0 낮아요" 는 말이 아니다.
    호출부가 줄을 만들지 않도록 `null` 로 돌려준다.
  */
  if (known.length < 2) return { rate, average: null, belowAverage: null }

  const average = Math.round(known.reduce((sum, value) => sum + value, 0) / known.length)

  /*
    **반올림한 값끼리 뺀다.** 원값으로 빼면 화면의 세 숫자가 서로 안 맞는다 — 평균 82.5(→83)
    와 값 57.4(→57)의 원값 차는 25.1(→25)이지만, 화면에는 `83` 과 `57` 이 적혀 있어
    읽는 사람이 기대하는 차이는 26 이다.
  */
  const belowAverage = average - rate

  return { rate, average, belowAverage: belowAverage > 0 ? belowAverage : null }
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
