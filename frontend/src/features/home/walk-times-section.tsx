'use client'

import { METRIC_WORD_TONE } from '@/components/metric'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { Skeleton } from '@/components/skeleton'
import { formatCelsius } from '@/lib/format/celsius'
import type { GoldenWindowRun } from '@/lib/insight/golden-window'
import {
  describeGoldenWindow,
  formatHourRuns,
  markGoldenWindow,
  SAFE_CODE,
} from '@/lib/insight/golden-window'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_BLEED_END_CLASS, INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { CodeNameMetadata } from '@/types/api'
import type { HourlyWalkSafetyItem, WalkTimesResponse } from '@/types/insight'

/**
 * 오늘의 산책 골든타임 — `GET /insights/walk-times` (#158).
 *
 * **바로 위 산책 위험도와 답하는 질문이 다르다.** 저쪽은 "지금 나가도 되나", 이쪽은
 * "오늘 언제 나가야 하나" 다. 여름 제주에서는 낮에 어차피 못 나가고 문제는 아침이
 * 나은지 저녁이 나은지다.
 *
 * **추천이 없는 날을 지어내지 않는다.** 남은 시간이 전부 위험이거나 특보 경보가 발효
 * 중이면 서버가 구간을 주지 않는다 — "그나마 이때가 낫다" 고 말하면 사용자가 그것을
 * 허락으로 읽는다 (`GoldenWalkWindow`). 그때도 **곡선은 그대로 보여 준다**: 근거를
 * 감추면 왜 안 되는지 확인할 방법이 없다.
 *
 * **판정 자리는 서버 `goldenWindowStatus` 가 고른다** (#204 · #262 ·
 * [#270](https://github.com/8llow8llowMe/hondigagae/issues/270)).
 *
 * | `goldenWindowStatus` | 화면 | 뜻 |
 * |------|------|-----|
 * | `AVAILABLE` | `GoldenWindow` | 이때 나가면 된다 |
 * | `SUPPRESSED_BY_WARNING` | `SuppressedByWarning` | **보류**: 경보라 곡선이 좋아도 추천하지 않는다 |
 * | `ALL_HOURS_RISKY` | `NoGoldenWindow` | **판정**: 남은 시간이 전부 위험이다 |
 * | `NO_FORECAST` | `NoForecast` (+ `UNAVAILABLE` 이면 **재시도**) | **근거 없음**: 판정할 예보가 없다 |
 *
 * **불린 두 개(`hasGolden`·`hasForecast`)로는 표현되지 않는다.** 그렇게 갈랐을 때
 * 두 번 틀렸다:
 *
 *  - 늦은 밤 `hourly: []` 를 "남은 시간이 모두 위험" 이라고 단정했다 (#204, dev 23:17 KST).
 *  - **풍랑경보 날 곡선에는 저녁 안전 구간이 초록으로 그려져 있는데 같은 문장이 나갔다**
 *    (#270). 곡선과 문장이 서로 다른 말을 하면 사용자는 둘 다 믿지 않는다.
 *
 * 둘 다 **모르는 것·보류를 나쁜 것으로 말한** 경우다 (루트 `CLAUDE.md`).
 *
 * **판정 순서를 여기서 다시 짜지 않는다.** 서버 `GoldenWindowStatus.of` 가 예보 → 경보 →
 * 구간 순으로 정한다 — 화면이 `if` 를 다시 세우면 한쪽만 고쳐져 같은 상태에 다른 문구가
 * 나간다. `weatherWarning` 을 보고 보류를 직접 판정하지 않는 이유도 그것이다
 * (경보/주의보 구분도 서버 몫이다).
 *
 * **`NO_FORECAST` 안에서 한 번 더 갈린다** (#262). 곡선이 비는 이유는 하나가 아니라
 * `forecastCoverage` 가 답한다 — `UNAVAILABLE`(다시 시도하면 되는 일시 장애)을
 * `DAY_ENDED`(정상, 자정 이후 채워짐)와 같은 문장으로 말하지 않는다. **고칠 수 있는
 * 상태를 고칠 수 없는 것처럼 말하지 않는다** — `404` 에 재시도를 달지 않는 규칙과 같은 축이다.
 */
export function WalkTimesSection({
  data,
  loading = false,
  positionFallback = false,
  onRetry,
}: {
  data: WalkTimesResponse | null
  loading?: boolean
  /**
   * 위치를 못 얻어 제주 중심으로 조회했는지 (#180). **그 사실을 감추지 않는다** —
   * 곡선은 좌표에 딸린 값이라 어디 기준인지 모르면 읽을 수 없다.
   */
  positionFallback?: boolean
  /**
   * 날씨를 못 받았을 때만 쓰는 재조회 (#262). **없으면 버튼을 렌더하지 않는다** —
   * 누를 수는 있는데 아무 일도 없는 버튼을 두지 않는다.
   */
  onRetry?: () => void
}) {
  // 조회 실패는 섹션을 통째로 숨긴다 — 홈의 최소 골격에 이 섹션은 없다 (공통명세 S4-1)
  if (data === null) return loading ? <WalkTimesSkeleton /> : null

  const status = goldenWindowStatusOf(data)

  return (
    /*
      **위 테두리가 카드 테두리로 바뀌었다** (#428). 2a 에서는 이 섹션이 `border-t` 로
      바로 위 판정과 이어져 "같은 이야기" 임을 말했는데, 3a 에서는 둘이 각자 카드다.
      **인접이 그 관계를 계속 말한다** — 판정 카드 바로 아래에 붙어 있고 사이에 다른
      섹션이 끼지 않는다 (`home-view.tsx` 의 좌측 레일 순서).

      **특보 배지가 여기 없다** (#349). 페이지 최상단 `WeatherWarningStrip` 하나가
      말한다 — 그래야 감싸던 flex 줄도 함께 사라진다.
    */
    <section aria-label={messages.home.goldenHeading} className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-5 md:py-5">
        {/*
          **카드가 아니라 카드 안의 블록이다** (#428). 판정과 같은 카드에 산다 — 갈라
          놓으면 "지금 나가도 되나 → 그럼 언제 나가나" 가 같은 판정 규칙을 쓴다는 것이
          안 읽힌다 (`walk-verdict.tsx` 머리주석).
        */}
        <h2 className="text-title-2 text-fg md:text-title-1 font-semibold md:font-bold">
          {messages.home.goldenHeading}
        </h2>

        {/*
          **서버가 고른 상태를 그대로 따른다** (#270). 예전에는 `hasGolden` → `hasForecast`
          순으로 화면이 갈랐는데, 그 두 불린에는 "경보라 보류" 가 들어갈 자리가 없었다.
        */}
        {status === 'AVAILABLE' ? (
          <GoldenWindow data={data} />
        ) : status === 'SUPPRESSED_BY_WARNING' ? (
          <SuppressedByWarning />
        ) : status === 'ALL_HOURS_RISKY' ? (
          <NoGoldenWindow />
        ) : (
          <NoForecast coverage={data.forecastCoverage} onRetry={onRetry} />
        )}

        <HourlyCurve data={data} />

        <p className="text-caption text-fg-muted font-medium">
          {positionFallback ? messages.home.goldenBasis : messages.home.goldenBasisCurrent} ·{' '}
          {messages.home.goldenPavementNote}
        </p>
      </div>
    </section>
  )
}

/**
 * 추천 구간. **시각을 문장으로도 적는다** — 아래 곡선의 강조만으로 전하면 색에 기대게 되고,
 * 그것은 DESIGN.md §2-3(색만으로 정보를 전달하지 않는다)에 어긋난다.
 */
function GoldenWindow({ data }: { data: WalkTimesResponse }) {
  const tone = walkSafetyTone(data.goldenLevel?.code)

  /*
    **시작과 끝이 같으면 구간이 아니라 한 시각이다** (#200). 그날 남은 시간대가 한 칸뿐이면
    서버가 둘을 같은 값으로 준다 — dev 22:12 KST 에 `23:00 – 23:00` 으로 관측했다. 대시로
    이으면 0분짜리 구간이 되어 고장으로 읽힌다.

    **구간으로 늘리지 않는다.** 예보 단위가 1시간이라 `23:00 – 24:00` 이 그럴듯해 보이지만,
    서버가 주지 않은 끝시각을 화면이 만드는 것이다 — 이 섹션은 "그나마 이때가 낫다" 를
    지어내지 않기로 한 자리다 (`goldenNone` 주석).
  */
  const single = data.goldenStart === data.goldenEnd

  /*
    **시각도 등급 색을 따른다.** 예전에는 `text-metric-high-700`(초록)이 하드코딩돼 있어,
    추천 구간의 등급이 `CAUTION` 인 날 **초록 시각 옆에 황갈색 "주의"** 가 섰다 — 한 줄
    안에서 색 두 개가 다른 말을 했다. 16px 일 때는 덜 보였는데 22px 로 키우면서 드러났다.

    **`-700` 층이다** (`METRIC_WORD_TONE`). `-500` 은 22px 이상 **+ weight 900** 에만
    허용되는데 이 시각은 700 이고, MID 의 `-500` 은 흰 배경에서 3.85:1 이라 글자로 쓰면
    대비가 무너진다.

    **등급 배지가 이 줄에서 빠졌다** (#637). `11:00 – 23:00 [주의]` 는 창 **전체**가
    주의라는 말로 읽혔는데 실제로 주의는 창 안의 두 칸이었다 — 배지가 가진 정보는 원래
    "어디가 주의인가" 이고 배지에는 그것을 적을 자리가 없다. 아래 문장이 그 자리다.

    **한 시각짜리 창에는 문장도 붙이지 않는다** (#200). 한 칸을 "내내" 라고 말할 수 없고,
    그 칸의 등급은 곡선 셀이 이미 색과 `sr-only` 로 전한다.
  */
  return (
    <div className="flex flex-col gap-1">
      <p className={cn('text-title-1 font-bold tabular-nums', METRIC_WORD_TONE[tone])}>
        {single ? (
          messages.home.goldenSingleHour.replace('{time}', hourMinute(data.goldenStart))
        ) : (
          <>
            {hourMinute(data.goldenStart)} – {hourMinute(data.goldenEnd)}
          </>
        )}
      </p>

      {!single && <GoldenWindowLevels data={data} />}
    </div>
  )
}

/**
 * 문장에서 등급 색을 받는 조각 — `{level} 등급`.
 *
 * **낱말을 여기서 새로 쓰지 않는다.** 이 문자열은 `goldenAllSafe` · `goldenCautionRuns`
 * 두 템플릿에 그대로 들어 있는 조각이고, 문장을 세 도막(앞 · 등급어 · 뒤)으로 가르는
 * 데만 쓴다. `{level}` 자리에는 서버 `walkSafetyLevel.name` 이 들어간다.
 *
 * 템플릿에서 이 조각이 사라지면 강조가 조용히 빠지므로 테스트가 그것을 잡는다
 * (`walk-times-section.test.ts`).
 */
const LEVEL_TOKEN = '{level} 등급'

/**
 * 문장이 두 줄을 넘지 않게 하는 글자 수 (골든타임-문구-세부명세 D4-2).
 *
 * 390px 에서 `body-1` 두 문장이 세 줄이 되면 헤드라인보다 문장이 커 보인다. 넘으면
 * **뒤 문장(좋은 구간)을 뺀다** — 곡선이 그 구간을 면으로 이미 보여 준다 (홈-세부명세 D4-1-c).
 */
const SENTENCE_MAX_LENGTH = 60

/**
 * 창 안의 등급 분포를 말하는 한 줄 — [#637](https://github.com/8llow8llowMe/hondigagae/issues/637).
 *
 * **`goldenLevel` 을 쓰지 않는다.** 그 값은 창 하나에 등급 하나를 붙인 것이라 "창 안
 * 어디가 주의인가" 를 말하지 못한다 — 그것이 배지가 모순으로 읽힌 이유다. 이 문장은
 * `hourly` 의 시각별 등급을 근거로 쓴다 (`describeGoldenWindow`).
 *
 * **등급어에만 색을 준다.** 색이 유일한 채널이 아니어야 하므로(DESIGN.md §2-3) 문장이
 * 낱말로 먼저 말하고, 색은 어디가 등급어인지 눈이 잡게 돕는 보조 채널이다. `-700` 층이다.
 */
function GoldenWindowLevels({ data }: { data: WalkTimesResponse }) {
  const { runs, worst } = describeGoldenWindow(data.hourly, data.goldenStart, data.goldenEnd)

  /*
    창 안 시각을 하나도 못 찾은 날 — 헤드라인만 두고 **조용히** 문장을 걷는다. 응답이
    어긋난 것이지 사용자가 할 일이 있는 상태가 아니다.
  */
  if (worst === null) return null

  const text = runs.length === 1 ? messages.home.goldenAllSafe : mixedLevelsText(runs, worst)
  const [before = '', after = ''] = text.split(LEVEL_TOKEN)

  return (
    <p className="text-body-1 text-fg-muted">
      {before}
      <span className={cn('font-semibold', METRIC_WORD_TONE[walkSafetyTone(worst.code)])}>
        {LEVEL_TOKEN.replace('{level}', worst.name)}
      </span>
      {after}
    </p>
  )
}

/**
 * 창 안에 등급이 둘 이상일 때의 문장.
 *
 * **"어디가 주의인가" 를 먼저 말한다.** 사람이 이 창에서 피해야 하는 시각이 그것이고,
 * 좋은 구간은 뒤에 덧붙는다 — 좋은 구간부터 말하면 주의가 단서처럼 뒤에 묻힌다.
 *
 * **안전 구간이 없으면 뒤 문장을 붙이지 않는다** — 없는 위안을 만들지 않는다.
 */
function mixedLevelsText(runs: readonly GoldenWindowRun[], worst: GoldenWindowRun): string {
  const risky = runs.filter((run) => run.code !== SAFE_CODE)
  const safe = runs.filter((run) => run.code === SAFE_CODE)

  const warning = messages.home.goldenCautionRuns
    .replace('{runs}', formatHourRuns(risky.map((run) => run.hours)))
    .replace('{pavement}', String(worst.maxPavement))

  if (safe.length === 0) return warning

  const better = messages.home.goldenBetterRuns.replace(
    '{runs}',
    formatHourRuns(safe.map((run) => run.hours)),
  )
  // 길이는 **렌더될 문장**으로 잰다 — `{level}` 자리에 들어갈 서버 이름의 길이가 다르다
  const rendered = `${warning}${better}`.replace('{level}', worst.name)

  return rendered.length > SENTENCE_MAX_LENGTH ? warning : `${warning}${better}`
}

/** 서버 `GoldenWindowStatus`. 모르는 값이 오면 옛 갈래로 떨어진다 — `goldenWindowStatusOf` */
type GoldenWindowStatusCode =
  'AVAILABLE' | 'SUPPRESSED_BY_WARNING' | 'ALL_HOURS_RISKY' | 'NO_FORECAST'

const GOLDEN_WINDOW_STATUSES: readonly string[] = [
  'AVAILABLE',
  'SUPPRESSED_BY_WARNING',
  'ALL_HOURS_RISKY',
  'NO_FORECAST',
]

/**
 * 판정 자리에 무엇을 세울지 (#270).
 *
 * **서버 값이 먼저다.** 판정 순서(예보 → 경보 → 구간)는 `GoldenWindowStatus.of` 가 갖고
 * 있고 화면은 그것을 다시 짜지 않는다.
 *
 * 서버 값을 쓰지 않는 두 경우가 있다.
 *
 *  - **모르는 코드** — 서버가 하나를 더 내면 `NO_FORECAST` 로 떨어져 "예보 없음" 을 말하게
 *    된다. 있지도 않은 사실이므로 옛 갈래로 내려가 아는 만큼만 말한다.
 *  - **`AVAILABLE` 인데 구간이 없다** — 그릴 것이 없다. 오지 않아야 할 조합이지만 오면
 *    빈 자리가 된다.
 *
 * **폴백은 예전 세 갈래 그대로다.** `weatherWarning` 을 보고 보류를 만들어 내지 않는다 —
 * 경보와 주의보를 가르는 규칙까지 화면이 복제하게 되고, 그러면 서버가 그 규칙을 고쳐도
 * 화면은 옛 규칙으로 답한다.
 */
function goldenWindowStatusOf(data: WalkTimesResponse): GoldenWindowStatusCode {
  const code = data.goldenWindowStatus?.code
  const hasGolden = data.goldenStart !== null && data.goldenEnd !== null

  if (code !== undefined && GOLDEN_WINDOW_STATUSES.includes(code)) {
    if (code !== 'AVAILABLE' || hasGolden) return code as GoldenWindowStatusCode
  }

  if (hasGolden) return 'AVAILABLE'
  return data.hourly.length > 0 ? 'ALL_HOURS_RISKY' : 'NO_FORECAST'
}

/**
 * 경보로 추천을 보류한 날 (#270).
 *
 * **위험 톤을 쓰지 않는다.** 이것은 판정이 아니라 보류다 — 곡선에 안전 구간이 남아 있고
 * 그것을 근거로 그대로 보여 준다. `NoGoldenWindow`(전부 위험)와 같은 색을 주면 두 상태가
 * 다시 한 덩어리로 읽힌다.
 *
 * **곡선이 초록인데 왜 추천이 없는지**를 말하는 것이 이 자리의 일이다. 그 어긋남이 이
 * 이슈의 제보였다.
 */
function SuppressedByWarning() {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body-1 text-fg-muted font-semibold">{messages.home.goldenSuppressed}</p>
      <p className="text-body-2 text-fg-muted">{messages.home.goldenSuppressedDesc}</p>
    </div>
  )
}

function NoGoldenWindow() {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body-1 text-metric-critical-700 font-semibold">
        {messages.home.goldenNone}
      </p>
      <p className="text-body-2 text-fg-muted">{messages.home.goldenNoneDesc}</p>
    </div>
  )
}

/** 다시 시도할 일인 것은 이 코드 하나뿐이다 — 서버 `ForecastCoverage` 주석 */
const COVERAGE_UNAVAILABLE = 'UNAVAILABLE'

/**
 * 판정할 예보가 없는 날 (#204 · #262).
 *
 * **위험 톤(`metric-critical`)을 쓰지 않는다.** 색은 등급을 말하는데 이 자리에는 등급이
 * 없다 — 미지는 미지의 모양이어야 한다 (DESIGN.md §2-3). 그래서 `NoGoldenWindow` 와
 * 나란히 두면서도 강조색을 뺀다.
 *
 * **문구를 서버가 준다** (#262). `forecastCoverage` 는 `{code, name, description}` metadata 라
 * 한국어 매핑 테이블을 FE 에 만들지 않는다 (`frontend/CLAUDE.md`) — 서버가 코드를 하나 더
 * 내도 화면은 그것을 그대로 말한다. `reasons[].description` 을 그대로 렌더하는 것과 같다.
 *
 * **`AVAILABLE` 인데 곡선이 비면 서버 문구를 쓰지 않는다.** 그 조합은 오지 않아야 하지만,
 * 오면 `예보 있음` 이라는 제목 아래 아무것도 없는 자리가 된다 — 그때는 우리 문구로
 * "모른다" 고 말하는 편이 맞다. 같은 이유로 **`forecastCoverage` 가 없어도**(옛 서버)
 * 예전 문구로 떨어진다.
 */
function NoForecast({
  coverage,
  onRetry,
}: {
  coverage: CodeNameMetadata | null
  onRetry?: (() => void) | undefined
}) {
  const server = coverage !== null && coverage.code !== 'AVAILABLE' ? coverage : null
  const retryable = server?.code === COVERAGE_UNAVAILABLE && onRetry !== undefined

  return (
    <div className="flex flex-col items-start gap-1">
      <p className="text-body-1 text-fg-muted font-semibold">
        {server?.name ?? messages.home.goldenNoForecast}
      </p>
      <p className="text-body-2 text-fg-muted">
        {server?.description ?? messages.home.goldenNoForecastDesc}
      </p>

      {/*
        **`UNAVAILABLE` 에만 단다.** `DAY_ENDED` 는 정상이고 자정 전에는 몇 번을 눌러도
        같은 응답이다 — 고칠 수 없는 것에 버튼을 달면 사용자가 계속 누른다.

        44px — 모바일 최소 터치 영역 (DESIGN.md §7). 장소 상세 판정 실패 자리와 같은 모양이다.
      */}
      {retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.common.retry}
        </button>
      )}
    </div>
  )
}

/**
 * 시간대 곡선.
 *
 * **가로 스크롤 한 줄이다.** 세로 목록으로 두면 8시간이 화면을 다 먹고, 곡선의 요점인
 * "언제부터 괜찮아지는가" 가 한눈에 안 들어온다.
 *
 * 셀마다 **시각 · 기온 · 막대 · 노면온도** 넷을 함께 둔다 (#269). 막대만 두면 색이 유일한
 * 정보가 되고, 두 온도가 이 판정의 실제 근거라 숫자로 보여야 사용자가 판단을 검증할 수 있다.
 *
 * **범례를 곡선 바로 아래 둔다.** 셀 안에는 라벨을 적을 자리가 없어 위치가 둘을 가르는데,
 * 그 위치가 무엇인지는 낱말이 말해야 한다. 섹션 맨 아래 캡션(`goldenPavementNote`)으로는
 * 부족했다 — 곡선과 캡션 사이에 다른 줄이 끼어 숫자와 이어 읽히지 않는다.
 */
function HourlyCurve({ data }: { data: WalkTimesResponse }) {
  // 훅은 early return 보다 위다 — 곡선이 비는 날과 아닌 날의 훅 순서가 달라지면 안 된다
  const rail = useScrollRail<HTMLUListElement>()

  const hourly = data.hourly

  /*
    추천 구간 표시 (#312). **문장이 가리키는 시각을 곡선에서도 짚는다** — 위에서
    `17:00 – 23:00` 을 추천해 놓고 아래 셀 중 어느 것이 그 구간인지 표시가 없어,
    시각을 하나씩 대조해야 문장과 그림이 이어졌다.

    **면의 색은 구간의 등급(`goldenLevel`)이다.** 칸마다의 등급이 아니다 — 이 면이
    말하는 것은 "서버가 추천한 구간" 하나이고, 칸마다 색이 갈리면 면이 아니라 줄무늬가 된다.
  */
  const marks = markGoldenWindow(hourly, data.goldenStart, data.goldenEnd)
  const windowTone = walkSafetyTone(data.goldenLevel?.code)

  // 판정 자리의 `NoForecast` 가 이미 말했다 — 같은 문장을 두 번 두지 않는다 (#204)
  if (hourly.length === 0) return null

  return (
    /*
      **행 라벨 열 + 스크롤러.** 라벨을 스크롤러 *바깥* 형제로 둔다 — 안에 `sticky` 로
      넣으면 마스크가 왼쪽 24px 를 투명하게 지우면서 라벨까지 흐린다. 그것을 피하려면
      왼쪽 그라데이션과 "이전" 화살표를 포기해야 해서, 바깥에 두는 쪽을 골랐다.

      대신 두 열이 각자 행 높이를 갖는다. **`RowLabels` 는 `HourCell` 의 구조를 그대로
      미러링해야 한다** — 같은 `gap-1.5`, 같은 `text-caption` 줄, 같은 `h-8` 막대 자리.
      한쪽만 고치면 라벨이 숫자와 어긋난 줄에 선다. 둘을 붙여 둔 이유다.
    */
    <div className="flex items-start gap-2">
      <RowLabels />

      {/*
        **`scroll-rail` 은 화살표의 기준면이다** (`app/globals.css`). 화살표를 `<ul>` 안에
        넣으면 마스크가 화살표까지 흐리고 내용과 같이 스크롤돼 제자리에 남지 않는다
        (`ScrollRailArrows` 주석).

        **`relative` 만 주면 안 된다** — 안쪽 스크롤러의 내용 폭이 조상의 `scrollWidth` 로
        새어 `main` 이 390 → 630 이 된다. 그 클래스가 `contain: layout` 을 함께 건다.

        **넘침은 오른쪽뿐이다** (`INSET_BLEED_END_CLASS`). 왼쪽에는 라벨 열이 서 있어
        파고들 자리가 없다.
      */}
      <div className="scroll-rail min-w-0 flex-1">
        <ul
          ref={rail.ref}
          onScroll={rail.onScroll}
          className={cn(
            /*
              **칸 사이 간격을 `gap` 이 아니라 셀 안쪽 padding 으로 준다** (#312).
              `gap` 이면 추천 구간의 tint 면이 칸마다 끊겨 면이 아니라 줄무늬로 읽힌다.
              padding 은 배경이 함께 칠해지므로 이웃한 칸의 면이 정확히 맞닿는다.
              간격은 6 → 8 이 된다. 3px 씩 나눠 6 을 유지하려면 스케일 밖 값이 되고
              (DESIGN.md §4 — arbitrary value 금지), 8 은 스케일 안 값이다.
            */
            'flex overflow-x-auto',
            INSET_BLEED_END_CLASS.card,
            // 스크롤바 자리는 fade 와 화살표가 대신한다 (`app/globals.css`)
            'scrollbar-none',
            rail.fadeClassName,
          )}
        >
          {hourly.map((hour, index) => (
            <HourCell
              key={hour.at}
              hour={hour}
              inGoldenWindow={marks[index]?.inWindow ?? false}
              windowTone={windowTone}
            />
          ))}
        </ul>

        <ScrollRailArrows
          rail={rail}
          prevLabel={messages.home.goldenCurvePrev}
          nextLabel={messages.home.goldenCurveNext}
        />
      </div>
    </div>
  )
}

/**
 * 곡선 왼쪽의 고정 행 라벨 — **범례를 대신한다.**
 *
 * 예전에는 곡선 아래 한 줄(`위는 기온 · 아래는 노면(아스팔트)`)로 위치를 설명했다.
 * 그 줄을 읽고 다시 위로 올라와 대응시켜야 했고, 셀 안에서 두 숫자를 가르는 채널은
 * 색 하나뿐이었다 (DESIGN.md §2-3 — 색이 유일한 채널이면 안 된다).
 *
 * **`aria-hidden` 이다.** 같은 낱말이 셀마다 `sr-only` 로 이미 붙어 있다 — 스크린리더는
 * 셀을 선형으로 읽으므로 바깥 라벨과 묶이지 않고, 그대로 두면 낱말이 두 번 들린다.
 *
 * **`HourCell` 과 같은 리듬으로 쌓는다.** 시각 자리(빈 줄) → 기온 → 노면. 한쪽 구조가
 * 바뀌면 다른 쪽도 같이 바꾼다 — 예전에 있던 `h-8` 막대 자리는 막대와 함께 걷었다 (#312).
 */
function RowLabels() {
  return (
    <div
      aria-hidden
      className="text-caption text-fg-muted flex shrink-0 flex-col gap-1.5 pt-0 font-medium"
    >
      {/* 시각 줄 자리. 라벨이 없지만 높이는 차지해야 아래 두 낱말이 숫자와 같은 줄에 선다 */}
      <span aria-hidden>&nbsp;</span>
      <span>{messages.home.goldenCurveRowTemperature}</span>
      <span>{messages.home.goldenCurveRowPavement}</span>
    </div>
  )
}

/**
 * 추천 구간 tint 면 — **`-100` 층**이다 (#312).
 *
 * 예전에는 이 색이 `-500` 층 세로 막대에 있었다. 그 막대는 `h-8 w-2` 고정이라 **길이가
 * 변하지 않으면서 막대의 형태를 하고 있었다** — 사람은 막대를 보면 길이를 읽으려 하는데
 * 읽을 것이 없었다. `DESIGN.md` §10 이 이미 금지한 것이기도 하다 (장식성 세로 바는
 * `ReasonList` 근거 부호의 3px 바에만).
 *
 * 그 색을 **문장이 가리키는 구간**으로 옮겼다. 면은 12px 숫자의 배경이 되므로 텍스트 대비
 * 규칙에 걸린다 — `-500` 이 아니라 tint 층인 `-100` 을 쓴다.
 */
const WINDOW_TINT: Record<string, string> = {
  critical: 'bg-metric-critical-100',
  high: 'bg-metric-high-100',
  mid: 'bg-metric-mid-100',
  low: 'bg-metric-low-100',
  unknown: 'bg-band',
}

/**
 * 한 시각 — **시각 · 기온 · 막대 · 노면온도** ([#269](https://github.com/8llow8llowMe/hondigagae/issues/269)).
 *
 * **예전에는 숫자가 하나뿐이었다.** 노면온도만 찍혀 있어 사용자가 그것을 기온으로 읽었다 —
 * 기온 29℃ 인 날 `56.0℃` 를 보고 "온도가 잘못된 것 같다" 는 제보가 실제로 왔다. 값도
 * 계산도 정상이었고, **그 값이 무엇인지가 전달되지 않은 것**이다. `temperature` 는 응답에
 * 이미 있었는데 화면이 버리고 있었다.
 *
 * 둘을 나란히 두면 **"기온은 괜찮은데 지면이 뜨겁다"** 는 이 서비스의 요점이 그대로 간다.
 *
 * **위치가 둘을 가른다.** 3rem 폭에 `기온 29℃` 는 들어가지 않고 줄을 나누면 여러 줄짜리
 * 셀이 되어 가로 한 줄이라는 이 곡선의 성격이 사라진다. 그래서
 *  - **눈으로는** 위치(위=기온, 아래=노면)와 왼쪽 고정 행 라벨(`RowLabels`)
 *  - **보조기기에는** 낱말(`기온` · `추정 노면(아스팔트) 온도` · 등급 이름)
 *
 * 자리와 색만으로 전달하지 않는다 (DESIGN.md §2-3) — 두 채널이 같은 사실을 말한다.
 *
 * **세로 막대를 걷었다** (#312). `h-8 w-2` 고정이라 길이가 변하지 않으면서 막대의 형태를
 * 하고 있었고, 그 색은 추천 구간 표시로 옮겼다 (`WINDOW_TINT`).
 */
function HourCell({
  hour,
  inGoldenWindow,
  windowTone,
}: {
  hour: HourlyWalkSafetyItem
  /** 이 칸이 서버가 추천한 구간에 드는가 (`markGoldenWindow`) */
  inGoldenWindow: boolean
  /** 구간 전체의 등급 톤. 칸마다의 등급이 아니다 */
  windowTone: string
}) {
  const tone = walkSafetyTone(hour.walkSafetyLevel.code)
  const temperature = formatCelsius(hour.temperature)
  const pavement = formatCelsius(hour.estimatedPavementCelsius)

  return (
    <li
      className={cn(
        // 두 칸이 맞닿아 8px 이 된다 — 스케일 안 값이다 (DESIGN.md §4: 4 · 6 · 8 …)
        'flex shrink-0 flex-col items-center gap-1.5 px-1 py-1',
        // 라운드를 주지 않는다 — 목록·섹션에 라운드가 없다 (DESIGN.md §0)
        inGoldenWindow && WINDOW_TINT[windowTone],
      )}
      // 3rem(칸) + 8px(안쪽 여백). 예전 피치(48 + gap 6)보다 칸당 2px 넓다
      style={{ minWidth: '3.5rem' }}
    >
      <span className="text-caption text-fg-muted font-medium tabular-nums">
        {hourOnly(hour.at)}
      </span>

      {/*
        **기온에는 톤을 주지 않는다.** 사람이 외출을 정할 때 먼저 보는 값이지만 등급을
        가르는 것은 아래 노면온도이고, 두 숫자가 다 색을 가지면 무엇이 판정인지 흐려진다.
      */}
      <span className="text-caption text-fg font-medium tabular-nums">
        <span className="sr-only">{messages.home.temperatureLabel} </span>
        {temperature === null ? '—' : `${temperature}℃`}
      </span>

      {/*
        **등급 색이 노면 숫자로 내려왔다** (#312). 걷어낸 막대가 갖고 있던 정보다 —
        `-700` 층이라 12px 글자에 써도 대비가 선다 (`METRIC_WORD_TONE`, DESIGN.md §2-3).

        **색이 유일한 채널이 아니다.** 무엇의 온도인지는 왼쪽 행 라벨이 낱말로 말하고,
        등급 이름은 아래 `sr-only` 가 보조기기에 그대로 전한다.
      */}
      <span className={cn('text-caption font-medium tabular-nums', METRIC_WORD_TONE[tone])}>
        <span className="sr-only">{messages.home.pavementLabel} </span>
        {pavement === null ? '—' : `${pavement}℃`}
      </span>

      {/*
        막대와 함께 사라질 뻔한 낱말이다. 화면에서는 tint 면과 숫자가 말하지만 둘 다
        스크린리더에는 아무 말도 하지 못한다.
      */}
      <span className="sr-only">{hour.walkSafetyLevel.name}</span>
    </li>
  )
}

/**
 * **실제 섹션과 같은 인셋·같은 층이다** (#475).
 *
 * 예전에는 둘이 두 군데서 갈렸다. 인셋이 `rail`(16/40)이라 로딩이 끝나는 순간 글줄이
 * 20px 뛰었고 — 실제 섹션은 `px-4 md:px-5`(16/20)다 — 끝에 `bg-band h-2 w-full` 을 하나
 * 더 그렸다. 그 8px 밴드는 지운 2a `Band` 의 출력과 문자 그대로 같고, **카드 안 마지막
 * 자식이라 각진 불투명 면이 radius 12 모서리를 덮는다** (`DESIGN.md §0`). 3a 에서 묶음
 * 경계는 카드 경계와 `SurfaceStack` 간격이 맡는다.
 */
function WalkTimesSkeleton() {
  return (
    <section aria-hidden className="border-border border-t">
      <div className={cn('flex flex-col gap-3 py-4 md:py-5', INSET_CLASS.card)}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-14 w-full" />
      </div>
    </section>
  )
}

/** `2026-08-29T18:00:00` → `18:00`. **서버 문자열을 그대로 자른다** — `Date` 로 파싱하면
 * 서버가 준 지역 시각이 브라우저 타임존으로 밀린다 */
function hourMinute(at: string | null): string {
  return at === null ? '' : at.slice(11, 16)
}

/** `2026-08-29T18:00:00` → `18시` */
function hourOnly(at: string): string {
  return `${at.slice(11, 13)}시`
}
