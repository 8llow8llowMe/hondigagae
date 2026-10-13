import { BEYOND_FORECAST_RANGE_REASON_CODE, type PlanDayWeatherItem } from '@/types/plan'

/**
 * 그 일자가 무엇을 아직 모르는가 (#1426).
 *
 * - `all` — 적합도 판정도 예보 밖이다. 산책 위험도(시각별 예보, 범위가 더 짧다)도 당연히 밖이다
 * - `walk` — 적합도는 났지만 산책 위험도만 예보 밖이다
 */
export type DayForecastPending = 'all' | 'walk'

export type PlanForecastNotice = {
  /** 일정 상단에 **한 번** 세울 서버 문장들. 같은 문장은 한 번만 */
  sentences: string[]
  /** 칩을 붙일 일자 → 무엇이 예보 전인가 */
  pendingByDay: ReadonlyMap<number, DayForecastPending>
}

/**
 * 예보 범위 밖 안내를 일정 단위로 접는다 — 이슈 #1426 · 일정상세-세부명세 D27-1.
 *
 * 예전에는 일자 카드마다 판정 자리의 `예보는 오늘부터 …` 와 산책 위험도의 `… 나흘 뒤까지입니다…`
 * 가 섰다 — 3일 일정이면 같은 두 문장이 여섯 번이었다. **두 문장 다 날짜만의 함수**라(오늘부터
 * N일) 일정 위에서 한 번 말해도 잃는 것이 없다.
 *
 * **`BEYOND_FORECAST_RANGE` 만 끌어올린다.** 지난 날(`PAST_DATE`) · 장소 없음 · 조회 실패는
 * 날마다 갈리는 사실이라 일자가 각자 말한다 (#717 이 `dayBeyondForecastReason` 에 세운 규칙).
 *
 * **문장은 서버 것이다** — 예보 범위(11일 · 5일)는 서버 상수라 화면이 베껴 두면 갈린다.
 *
 * @param walkBeyondByDay 일자 → `dayBeyondForecastReason()` 결과. 그 함수가 "그날 항목이
 *   전부 예보 밖" 일 때만 문장을 주므로, 섞인 날은 `null` 이고 행이 각자 말한다.
 */
export function planForecastNotice({
  verdicts,
  walkBeyondByDay,
}: {
  verdicts: readonly PlanDayWeatherItem[]
  walkBeyondByDay: ReadonlyMap<number, string | null>
}): PlanForecastNotice | null {
  const pendingByDay = new Map<number, DayForecastPending>()
  let verdictSentence: string | null = null
  let walkSentence: string | null = null

  for (const verdict of verdicts) {
    if (verdict.unavailableReasonCode !== BEYOND_FORECAST_RANGE_REASON_CODE) continue

    pendingByDay.set(verdict.day, 'all')
    verdictSentence ??= verdict.unavailableReason
  }

  for (const [day, reason] of walkBeyondByDay) {
    if (reason === null) continue

    walkSentence ??= reason
    if (!pendingByDay.has(day)) pendingByDay.set(day, 'walk')
  }

  const sentences = [verdictSentence, walkSentence].filter(
    (sentence): sentence is string => sentence !== null && sentence !== '',
  )

  /*
    **말할 문장이 없으면 칩도 없다.** 칩은 "이유는 위에 있다" 는 가리킴이라, 위에 아무것도 서지
    않으면 이유 없는 칩만 남는다. 코드만 오고 문장이 빈 응답은 계약 밖이지만 그때도 거짓을 그리지 않는다.
  */
  if (pendingByDay.size === 0 || sentences.length === 0) return null

  return { sentences: [...new Set(sentences)], pendingByDay }
}
