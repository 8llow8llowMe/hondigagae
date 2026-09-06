'use client'

import { MetricWord } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatCelsius } from '@/lib/format/celsius'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
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
    <section aria-label={messages.home.goldenHeading} className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <h2 className="text-body-1 font-semibold">{messages.home.goldenHeading}</h2>
          <WeatherWarningBadge warning={data.weatherWarning} />
        </div>

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

        <HourlyCurve hourly={data.hourly} />

        <p className="text-caption text-fg-muted font-medium">
          {positionFallback ? messages.home.goldenBasis : messages.home.goldenBasisCurrent} ·{' '}
          {messages.home.goldenPavementNote}
        </p>
      </div>

      <div aria-hidden className="bg-band h-2 w-full" />
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

  return (
    <p className="text-body-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-semibold tabular-nums">
      <span className="text-metric-high-700 text-title-3">
        {single ? (
          messages.home.goldenSingleHour.replace('{time}', hourMinute(data.goldenStart))
        ) : (
          <>
            {hourMinute(data.goldenStart)} – {hourMinute(data.goldenEnd)}
          </>
        )}
      </span>
      {data.goldenLevel !== null && <MetricWord tone={tone}>{data.goldenLevel.name}</MetricWord>}
    </p>
  )
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
function HourlyCurve({ hourly }: { hourly: HourlyWalkSafetyItem[] }) {
  // 판정 자리의 `NoForecast` 가 이미 말했다 — 같은 문장을 두 번 두지 않는다 (#204)
  if (hourly.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:-mx-6 md:px-6">
        {hourly.map((hour) => (
          <HourCell key={hour.at} hour={hour} />
        ))}
      </ul>
      {/* 셀의 sr-only 라벨과 같은 사실을 눈으로도 말한다 — 자리만으로 전달하지 않는다 */}
      <p aria-hidden className="text-caption text-fg-muted font-medium">
        {messages.home.goldenCurveLegend}
      </p>
    </div>
  )
}

/**
 * 막대 색은 등급 톤의 **-500 층**이다. 3px 지표 바와 같은 자리라 12px 텍스트 대비 규칙이
 * 걸리지 않는다 (DESIGN.md §2-3 — `-500` 은 지표 바와 stroke 아이콘 전용).
 */
const BAR_TONE: Record<string, string> = {
  critical: 'bg-metric-critical-500',
  high: 'bg-metric-high-500',
  mid: 'bg-metric-mid-500',
  low: 'bg-metric-low-500',
  unknown: 'bg-metric-unknown-500',
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
 * **막대가 둘을 가른다.** 3rem 폭에 `기온 29℃` 는 들어가지 않고 줄을 나누면 여섯 줄짜리
 * 셀이 되어 가로 한 줄이라는 이 곡선의 성격이 사라진다. 그래서
 *  - **눈으로는** 위치(막대 위=기온, 아래=노면) + 진하기, 그리고 곡선 바로 아래 범례
 *  - **보조기기에는** 낱말(`기온` · `추정 노면(아스팔트) 온도`)
 *
 * 자리와 색만으로 전달하지 않는다 (DESIGN.md §2-3) — 두 채널이 같은 사실을 말한다.
 */
function HourCell({ hour }: { hour: HourlyWalkSafetyItem }) {
  const tone = walkSafetyTone(hour.walkSafetyLevel.code)
  const temperature = formatCelsius(hour.temperature)
  const pavement = formatCelsius(hour.estimatedPavementCelsius)

  return (
    <li className="flex shrink-0 flex-col items-center gap-1.5" style={{ minWidth: '3rem' }}>
      <span className="text-caption text-fg-muted font-medium tabular-nums">
        {hourOnly(hour.at)}
      </span>

      {/*
        **기온이 노면보다 진하다.** 사람이 외출을 정할 때 실제로 보는 값이 이쪽이고,
        노면은 그 판단을 뒤집는 근거다 — 등급 색은 막대가 이미 말하므로 여기에 톤을 주지
        않는다 (판정을 말하는 자리가 둘이 되면 무엇이 판정인지 흐려진다).
      */}
      <span className="text-caption text-fg font-medium tabular-nums">
        <span className="sr-only">{messages.home.temperatureLabel} </span>
        {temperature === null ? '—' : `${temperature}℃`}
      </span>

      {/*
        등급 이름을 화면에서 지우지 않는다 — 막대는 색뿐이라 스크린리더에 아무 말도 하지
        못한다. 시각적으로는 숫자가 대신하므로 이름은 보조기기 전용으로 둔다.
      */}
      <span className={cn('h-8 w-2 rounded-full', BAR_TONE[tone])}>
        <span className="sr-only">{hour.walkSafetyLevel.name}</span>
      </span>

      <span className="text-caption text-fg-muted font-medium tabular-nums">
        <span className="sr-only">{messages.home.pavementLabel} </span>
        {pavement === null ? '—' : `${pavement}℃`}
      </span>
    </li>
  )
}

function WalkTimesSkeleton() {
  return (
    <section aria-hidden className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="bg-band h-2 w-full" />
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
