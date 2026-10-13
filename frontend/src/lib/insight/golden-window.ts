import { messages } from '@/lib/messages'
import type { HourlyWalkSafetyItem } from '@/types/insight'

/**
 * 이 시각이 추천 구간에 드는가 — #312.
 *
 * 곡선 위에서 `17:00 – 23:00` 이라고 추천해 놓고 **아래 셀 중 어느 것이 그 구간인지
 * 표시가 없었다.** 시각을 하나씩 대조해야 문장과 곡선이 이어졌다.
 *
 * **문자열로 견준다.** 서버가 `2026-08-29T18:00:00` 같은 지역 시각 문자열을 주는데
 * `Date` 로 파싱하면 브라우저 타임존으로 밀린다 (`hourMinute` 과 같은 이유다). 세 값이
 * 같은 응답에서 같은 형식으로 오므로 사전순 비교가 곧 시각순 비교다.
 *
 * **양끝을 포함한다.** `17:00 – 23:00` 은 17시 셀과 23시 셀을 함께 가리킨다 — 문장이
 * 그 두 시각을 적어 놓고 셀에서 빼면 문장과 그림이 다시 어긋난다.
 *
 * **`goldenStart == goldenEnd` 인 한 시각짜리 날이 정상이다** (#200). 그 한 칸만 든다.
 *
 * 구간이 없는 날(`null`)과 끝이 시작보다 앞선 날은 **아무 칸도 들지 않는다** — 뒤집힌
 * 구간을 화면이 해석해서 없는 추천을 만들지 않는다.
 */
export function isWithinGoldenWindow(
  at: string,
  goldenStart: string | null,
  goldenEnd: string | null,
): boolean {
  if (goldenStart === null || goldenEnd === null) return false
  if (goldenEnd < goldenStart) return false

  return at >= goldenStart && at <= goldenEnd
}

/**
 * 셀마다 추천 구간 여부와 **구간의 양끝인지**를 함께 낸다.
 *
 * 양끝을 아는 이유는 tint 면이 어디서 시작하고 끝나는지 눈에 보여야 하기 때문이다 —
 * 가운데 칸과 끝 칸을 구분하지 못하면 면이 곡선 전체로 흐른 것처럼 읽힌다.
 *
 * **`hourly` 의 순서를 그대로 쓴다.** 서버가 시각순으로 주고, 재정렬하지 않는다.
 */
export function markGoldenWindow(
  hourly: readonly HourlyWalkSafetyItem[],
  goldenStart: string | null,
  goldenEnd: string | null,
): { inWindow: boolean; windowStart: boolean; windowEnd: boolean }[] {
  const flags = hourly.map((hour) => isWithinGoldenWindow(hour.at, goldenStart, goldenEnd))

  return flags.map((inWindow, index) => ({
    inWindow,
    windowStart: inWindow && flags[index - 1] !== true,
    windowEnd: inWindow && flags[index + 1] !== true,
  }))
}

/** 창 안의 한 등급이 이어지는 구간 — `describeGoldenWindow` */
export type GoldenWindowRun = {
  /** 서버 `walkSafetyLevel.code`. 모르는 값이 그대로 올라온다 */
  code: string
  /** 서버 `walkSafetyLevel.name`. **FE 가 한국어를 다시 쓰지 않는다** */
  name: string
  /** 구간의 양끝 시(hour). 한 시각짜리 구간이면 둘이 같다 */
  hours: [number, number]
  /** 구간 안 `estimatedPavementCelsius` 최대값을 **정수로 반올림**한 값 */
  maxPavement: number
}

export type GoldenWindowDescription = {
  /** 창 안 시각을 등급별 연속 구간으로 묶은 것. 시각순이다 */
  runs: GoldenWindowRun[]
  /**
   * 가장 심한 **등급**의 구간. 창 안 시각이 없거나 **등급이 붙은 시각이 하나도 없으면**
   * (`UNKNOWN` 뿐) `null` 이다 — 등급이 아닌 것을 등급 자리에 올리지 않는다 (A-2).
   */
  worst: GoldenWindowRun | null
  /** 창 안이 전부 `SAFE` 인가. 창 안 시각이 없으면 `false` — 모름을 좋음으로 말하지 않는다 */
  allSafe: boolean
}

/**
 * 서버 `WalkSafetyLevel` 의 안전 코드.
 *
 * **내보내는 이유는 문장이 구간을 둘로 가르기 때문이다** — "어디가 주의인가" 와
 * "어디가 좋은가". 호출부가 `'SAFE'` 를 직접 적으면 두 곳에 같은 코드가 생긴다.
 */
export const SAFE_CODE = 'SAFE'

/**
 * 서버 `WalkSafetyLevel.UNKNOWN` — **"판단 근거 부족" 은 등급이 아니라 판단하지 않았다는
 * 말이다** ([#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **A-2**).
 *
 * **모르는 코드와 갈라 둔다.** 아래 `severityOf` 가 모르는 코드를 `CAUTION` 자리에 두는
 * 것은 *서버가 등급을 하나 더 냈을 때* 그것을 좋은 쪽으로 접지 않으려는 규칙이고, 이
 * 코드에는 해당하지 않는다 — 서버가 이미 "판단하지 않았다" 고 말한 값이다. 둘을 한
 * 상수로 묶어 두면 `UNKNOWN` 이 `CAUTION` 과 심각도가 같아져 **노면 온도가 높다는
 * 이유만으로 `worst` 를 이긴다.**
 *
 * 백엔드도 같은 태도다 — `WalkSafetyLevel.worseOf` 가 *"UNKNOWN 은 비교 대상이 아니라
 * 실제 판정이 있으면 그쪽을 택한다"* 로 적혀 있다.
 */
const UNKNOWN_CODE = 'UNKNOWN'

/**
 * 등급 심각도. **서버 코드 셋만 안다** (`SAFE` · `CAUTION` · `DANGER`).
 *
 * 모르는 코드는 `CAUTION` 자리에 둔다 (`UNKNOWN_SEVERITY`) — 서버가 등급을 하나 더 내면
 * 화면은 그 값을 모른 채 렌더해야 하고, 그때 `SAFE` 로 떨어뜨리면 **모르는 것을 좋은
 * 것으로** 말하게 된다 (루트 `CLAUDE.md`).
 *
 * **`UNKNOWN` 은 여기 오지 않는다** — `worst` 를 고르기 전에 걸러진다 (`UNKNOWN_CODE`).
 */
const SEVERITY: Record<string, number> = { SAFE: 0, CAUTION: 1, DANGER: 2 }
const UNKNOWN_SEVERITY = 1

function severityOf(code: string): number {
  return SEVERITY[code] ?? UNKNOWN_SEVERITY
}

/**
 * 창 안의 등급 분포 — [#637](https://github.com/8llow8llowMe/hondigagae/issues/637).
 *
 * **헤드라인 옆 배지가 창 전체의 등급으로 읽혔다.** `11:00 – 23:00 [주의]` 는 "좋은
 * 시간인데 주의?" 라는 모순이고, 실제로 주의는 창 안의 두 칸(14 · 15시)이었다 —
 * 2026-09-15 dev 실측. 배지가 가진 정보는 원래 **어디가 주의인가** 였는데 배지에는 그것을
 * 적을 자리가 없다. 그 사실을 문장으로 옮기려면 창 안의 분포가 있어야 하고, 이 함수가
 * 그것을 만든다.
 *
 * **창 판정은 `isWithinGoldenWindow` 하나를 쓴다** — 곡선의 tint 면(`markGoldenWindow`)과
 * 같은 규칙이어야 문장이 가리키는 시각과 면이 어긋나지 않는다. 양끝을 포함한다.
 *
 * **시각은 문자열에서 뽑는다.** `Date` 로 파싱하면 서버가 준 지역 시각이 브라우저 타임존
 * 으로 밀린다 (`hourMinute` · `isWithinGoldenWindow` 와 같은 이유다).
 *
 * **구간은 `hourly` 의 순서대로 묶는다.** 서버가 시각순으로 주고 재정렬하지 않는다 —
 * `markGoldenWindow` 와 같은 태도다.
 */
export function describeGoldenWindow(
  hourly: readonly HourlyWalkSafetyItem[],
  goldenStart: string | null,
  goldenEnd: string | null,
): GoldenWindowDescription {
  /*
    **반올림은 최대값을 고른 뒤에 한다.** 칸마다 먼저 반올림하면 45.9 와 46.3 이 둘 다
    46 이 되어 어느 칸이 정점인지 사라진다. 그래서 원값으로 모으고 마지막에 반올림한다.
  */
  const grouped: { code: string; name: string; from: number; to: number; pavement: number }[] = []

  for (const item of hourly) {
    if (!isWithinGoldenWindow(item.at, goldenStart, goldenEnd)) continue

    const hour = hourOf(item.at)
    const last = grouped[grouped.length - 1]

    if (last !== undefined && last.code === item.walkSafetyLevel.code) {
      last.to = hour
      last.pavement = Math.max(last.pavement, item.estimatedPavementCelsius)
      continue
    }

    grouped.push({
      code: item.walkSafetyLevel.code,
      name: item.walkSafetyLevel.name,
      from: hour,
      to: hour,
      pavement: item.estimatedPavementCelsius,
    })
  }

  const runs: GoldenWindowRun[] = grouped.map((run) => ({
    code: run.code,
    name: run.name,
    hours: [run.from, run.to],
    // 문장 속 소수는 데이터 냄새다 (진단 G-2). 곡선 셀의 소수 1자리는 그대로다 — 셀은 표, 문장은 말
    maxPavement: Math.round(run.pavement),
  }))

  /*
    **같은 심각도면 노면이 더 높은 구간이 이긴다.** 문장이 적는 온도가 그 구간에서 오므로,
    주의 구간이 둘인 날에 낮은 쪽 온도를 적으면 문장이 실제보다 순해진다.

    **`UNKNOWN` 구간은 후보가 아니다** (A-2). 등급이 아니라 "판단하지 않았다" 이므로
    이기면 문장이 `노면이 50℃까지 올라 판단 근거 부족 등급이에요` 가 된다 — 서버가
    매기지 않은 등급을 노면 온도로 단정하는 문장이다.
  */
  const worst = runs.reduce<GoldenWindowRun | null>((best, run) => {
    if (run.code === UNKNOWN_CODE) return best
    if (best === null) return run

    const gap = severityOf(run.code) - severityOf(best.code)
    if (gap > 0) return run
    if (gap === 0 && run.maxPavement > best.maxPavement) return run

    return best
  }, null)

  return {
    runs,
    worst,
    // 창 안 시각이 하나도 없으면 `false` 다 — 모르는 것을 좋은 것으로 말하지 않는다
    allSafe: runs.length > 0 && runs.every((run) => run.code === SAFE_CODE),
  }
}

/**
 * `[[11,13],[16,23]]` → `11–13시 · 16–23시`.
 *
 * **한 시각짜리 구간을 대시로 잇지 않는다** — `9–9시` 는 0분짜리 구간처럼 읽혀 고장으로
 * 보인다 (`goldenSingleHour` 과 같은 판단, #200).
 */
export function formatHourRuns(runs: readonly (readonly [number, number])[]): string {
  return runs
    .map(([from, to]) =>
      from === to
        ? messages.home.goldenHourSingle.replace('{from}', String(from))
        : messages.home.goldenHourRange.replace('{from}', String(from)).replace('{to}', String(to)),
    )
    .join(messages.home.goldenRunsJoin)
}

/** `2026-09-15T14:00:00` → `14`. **`Date` 를 쓰지 않는다** — 타임존으로 밀린다 */
function hourOf(at: string): number {
  return Number.parseInt(at.slice(11, 13), 10)
}

/** 헤드라인이 적을 구간. 둘 다 서버가 준 지역 시각 문자열 그대로다 */
export type GoldenSpan = { start: string; end: string }

/**
 * 헤드라인이 적을 구간 — [#1428](https://github.com/8llow8llowMe/hondigagae/issues/1428).
 *
 * **서버 창은 주의 시각을 품을 수 있다** (`GoldenWalkWindow.acceptableRuns` 가 `SAFE`·`CAUTION`
 * 을 함께 이어 붙인다 — #204 · #262 가 전제한 설계다). 그 창을 헤드라인에 그대로 적으면
 * `12:00 – 23:00` 아래에 "12시는 … 주의 등급이에요. 13–23시가 좋아요." 가 서서 숫자와 문장이
 * 어긋난다. 그래서 헤드라인은 **창 안의 안전 구간**을 적고, 주의 시각은 문장이 말한다.
 *
 * ### 안전 구간이 여럿이면 — 가장 긴 것, 길이가 같으면 가장 이른 것
 *
 * **서버가 창을 고르는 규칙과 같은 순서다** (`GoldenWalkWindow.from`: 안전 우선 → 길이 →
 * 이른 시작). 헤드라인은 "가장 좋은 한 구간" 을 말하는 자리이고, 서버가 같은 질문에 이미 그
 * 순서로 답하고 있다 — 화면이 다른 기준(예: 가장 이른 것)을 쓰면 같은 날 두 규칙이 생긴다.
 * 나머지 안전 구간은 바로 아래 문장(`goldenBetterRuns`)이 함께 적는다.
 *
 * 길이는 **칸 수**로 잰다 — `hourly` 가 1시간 단위라 칸 수가 곧 시간이다.
 *
 * ### 안전 구간을 만들지 못하면 서버 창 그대로
 *
 * - **안전 0칸** — 제목이 `나은 시간` 으로 바뀌는 갈래(#1362 `lacksSafeHour`)가 받는다. 그날
 *   헤드라인이 적을 "좋은" 구간은 없고, 서버 창이 그 "나은" 구간이다.
 * - **곡선이 비었거나 창 안 칸이 없다** — 쪼갤 근거가 없다. 아는 만큼만 말한다.
 *
 * **판단 근거 부족(`UNKNOWN`)은 안전이 아니다** — 안전 구간에 넣지 않는다 (A-2).
 *
 * 구간을 묶는 규칙은 `describeGoldenWindow` 와 같다(창 판정 · `hourly` 순서) — 그래야 이 구간이
 * 문장의 `{runs}` 중 하나와 정확히 겹친다.
 *
 * @returns 서버 창이 없으면 `null`
 */
export function headlineGoldenSpan(
  hourly: readonly HourlyWalkSafetyItem[],
  goldenStart: string | null,
  goldenEnd: string | null,
): GoldenSpan | null {
  if (goldenStart === null || goldenEnd === null) return null

  const safeRuns: { start: string; end: string; cells: number }[] = []
  let open = false

  for (const item of hourly) {
    if (!isWithinGoldenWindow(item.at, goldenStart, goldenEnd)) continue

    if (item.walkSafetyLevel.code !== SAFE_CODE) {
      open = false
      continue
    }

    const last = safeRuns[safeRuns.length - 1]
    if (open && last !== undefined) {
      last.end = item.at
      last.cells += 1
    } else {
      safeRuns.push({ start: item.at, end: item.at, cells: 1 })
      open = true
    }
  }

  // `>` 이라 길이가 같으면 먼저 나온(= 이른) 구간이 남는다
  const best = safeRuns.reduce<(typeof safeRuns)[number] | null>(
    (picked, run) => (picked === null || run.cells > picked.cells ? run : picked),
    null,
  )

  return best === null
    ? { start: goldenStart, end: goldenEnd }
    : { start: best.start, end: best.end }
}

/**
 * 창 안에 **안전 시각이 하나도 없는가** (#1362) — 제목이 `좋은 시간` 이라고 말해도 되는지.
 *
 * 서버가 창을 줬어도 그 안이 전부 `주의` 인 날이 있다. 그날 `오늘 산책하기 좋은 시간` 아래에
 * `이 시간대는 내내 주의 등급이에요` 가 서면 제목과 문장이 반대 말을 한다 — 골든타임-문구 D0 이
 * 등급이 섞인 날에 대해 푼 모순의 남은 갈래다. 그날만 제목이 `나은 시간` 이 된다.
 *
 * **모르는 것을 나쁜 것으로 말하지 않는다.** 판단 근거 부족(`UNKNOWN`)만 있는 창은 `worst` 가
 * `null` 이라 여기서 `false` 다 — 평소 제목 그대로다. 창 안 시각이 없을 때(응답 불일치)도 같다.
 */
export function lacksSafeHour({ runs, worst }: GoldenWindowDescription): boolean {
  if (worst === null || worst.code === SAFE_CODE) return false
  return !runs.some((run) => run.code === SAFE_CODE)
}
