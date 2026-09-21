'use client'

import { METRIC_WORD_TONE } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import { WalkTimesCurve } from '@/components/walk-times-curve'
import type { GoldenWindowRun } from '@/lib/insight/golden-window'
import { describeGoldenWindow, formatHourRuns, SAFE_CODE } from '@/lib/insight/golden-window'
import { walkSafetyTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { CodeNameMetadata } from '@/types/api'
import type { WalkTimesResponse } from '@/types/insight'

/**
 * 곡선을 잰 **기준점**. 불린이 아니라 서술인 이유가 이 타입의 전부다
 * ([#779](https://github.com/8llow8llowMe/hondigagae/issues/779)).
 *
 * 전에는 `positionFallback: boolean` 이었다. 두 값으로는 "기기 위치" 와 "제주 중심 폴백"
 * 밖에 말할 수 없는데, 코스 상세는 **코스 시작점**으로 조회한다 — 어느 쪽도 아니다.
 * 그 화면은 `false`(= 폴백 아님)를 넘겼고 화면에는 `현재 위치 기준` 이 나갔다.
 * **표현할 수 없는 상태를 불린에 욱여넣으면 가장 가까운 거짓이 나간다.**
 *
 * 기준점이 늘면 여기에 갈래를 더한다 — `BASIS_MESSAGE` 가 빠짐없음을 타입으로 강제한다.
 * **호출부의 명시는 타입이 아니라 `basis` 가 필수 prop 인 것이 강제한다** — 빠뜨려도
 * 기본값이 채워지면 이 버그가 "오매핑" 대신 "누락" 으로 되돌아온다.
 *
 * **`/emergency` 의 `EmergencyBasis` 와 별개다** (`features/emergency/resolve-anchor.ts`).
 * 겹치는 낱말이 있지만 같은 문자열이 다른 것을 뜻한다 — 거기서 `'제주시 기준'` 은
 * 사용자가 **고른 권역**이고 여기서는 **위치를 못 얻은 폴백**이다. 한쪽만 고치지 않는다.
 */
export type WalkTimesBasis = 'current' | 'jeju' | 'course-start'

/** 기준점 → 캡션 앞머리. `Record` 라 갈래를 더하면 여기서 컴파일이 멈춘다 */
const BASIS_MESSAGE: Record<WalkTimesBasis, string> = {
  current: messages.home.goldenBasisCurrent,
  jeju: messages.home.goldenBasis,
  'course-start': messages.home.goldenBasisCourseStart,
}

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
  basis,
  onRetry,
  retryLabel,
}: {
  data: WalkTimesResponse | null
  loading?: boolean
  /**
   * 조회에 쓴 좌표가 **어디서 왔는지** (#180 · #779). **그 사실을 감추지 않는다** —
   * 곡선은 좌표에 딸린 값이라 어디 기준인지 모르면 읽을 수 없다.
   */
  basis: WalkTimesBasis
  /**
   * 날씨를 못 받았을 때만 쓰는 재조회 (#262). **없으면 버튼을 렌더하지 않는다** —
   * 누를 수는 있는데 아무 일도 없는 버튼을 두지 않는다.
   */
  onRetry?: () => void
  /**
   * 재조회 버튼의 **접근 이름**. 기본은 `다시 시도` 이고 홈은 그것을 쓴다.
   *
   * 산책 코스 상세만 `날씨 다시 불러오기` 를 넘긴다 (`코스상세-세부명세.md` D6) — 그
   * 화면에서는 이 버튼이 코스 조회의 재시도와 나란히 설 수 있어 `다시 시도` 만으로는
   * 무엇을 다시 하는지 모른다. **판정 문구는 여기서 갈리지 않는다** (D5-1): 갈리는 것은
   * 버튼 이름 하나뿐이고, 기본값이 옛 문구라 홈 마크업은 그대로다.
   */
  retryLabel?: string
}) {
  /*
    **곡선의 스크롤 상태를 이 섹션이 든다** ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
    화살표를 제목 줄로 올리려면 상태가 제목과 곡선의 **공통 조상**에 있어야 한다.

    훅은 early return 보다 위다 — 예보가 없는 날과 있는 날의 훅 순서가 갈리면 안 된다.
  */

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
        {/*
          **화살표는 제목 줄이 아니라 표 좌우에 선다.**

          #730 이 반대로 옮겼던 자리다 — 근거는 오버레이 화살표가 오른쪽 끝 칸의 온도 값을
          덮는다는 것이었다(`elementsFromPoint(346, 702)` → `BUTTON` ▸ `SPAN "기온 26.0℃"`).
          **그 사실은 지금도 맞다.** 다만 제목 줄로 올린 뒤 화살표가 **무엇을 미는 컨트롤인지
          보이지 않는다**는 쪽이 더 크다고 판단해 되돌린다: 표에서 멀어진 버튼은 카드 전체를
          접는 버튼처럼 읽힌다.

          가려지는 쪽은 **오른쪽 끝 칸 하나**이고 그 칸은 fade 마스크가 이미 흐려 둔 자리다.
          또 `.scroll-rail-arrow` 가 `pointer: coarse` 에서 이 버튼을 숨기므로 **터치에서는
          아무것도 가리지 않는다** — 손가락은 밀어서 넘긴다.

          그리는 일은 `WalkTimesCurve` 에 돌려준다: `rail` 을 넘기지 않으면 자기 `.scroll-rail`
          안에 오버레이로 그린다. 여기서 레일을 들고 있을 이유가 사라졌다.
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
          <NoForecast coverage={data.forecastCoverage} onRetry={onRetry} retryLabel={retryLabel} />
        )}

        {/*
          **곡선 컴포넌트는 `src/components/` 에 산다** (#626). 출발 전 여행 브리핑이 같은
          곡선을 그리는데 feature 간 직접 임포트가 금지라 올렸다 — 이 자리의 마크업은 한
          글자도 바뀌지 않는다 (이 파일의 기존 테스트가 그 합격 기준이다).
        */}
        <WalkTimesCurve
          hourly={data.hourly}
          goldenStart={data.goldenStart}
          goldenEnd={data.goldenEnd}
        />

        <p className="text-caption text-fg-muted font-medium">
          {BASIS_MESSAGE[basis]} · {messages.home.goldenPavementNote}
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
    **시각에 등급 색을 주지 않는다** ([#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **A-3**).

    **등급 배지가 이 줄에서 빠졌다** (#637). `11:00 – 23:00 [주의]` 는 창 **전체**가
    주의라는 말로 읽혔는데 실제로 주의는 창 안의 두 칸이었다 — 배지가 가진 정보는 원래
    "어디가 주의인가" 이고 배지에는 그것을 적을 자리가 없다. 아래 문장이 그 자리다.

    **배지의 글자는 지웠는데 같은 주장을 하던 색이 남아 있었다.** `goldenLevel` 은 창 하나에
    등급 하나를 붙인 값이라(서버 `GoldenWalkWindow.level` 이 `worseOf` 로 접는다), 22px 굵은
    시각을 그 색으로 칠하면 **창 전체가 그 등급**이라고 말한다. dev 실측 2026-09-21:
    창 15:00–23:00 에 주의 한 칸 + 안전 여덟 칸인데 `goldenLevel=CAUTION` 이라 헤드라인이
    통째로 `metric-mid-700` 이었다. #656 으로 면이 칸마다 갈린 뒤로는 **이 색이 섹션에서
    유일하게 "창 하나에 등급 하나" 를 말하고 있었다.**

    그래서 색을 **걷는다**(후보 ①). `worst` 로 칠하는 후보 ③ 은 지금과 실질 같고, 분포를
    헤드라인 밖에서만 말하는 후보 ② 는 이미 아래 문장이 하고 있다. **이 줄이 말하는 것은
    등급이 아니라 시각**이고, 등급은 바로 아래 문장과 곡선 면이 칸 단위로 말한다 —
    색이 유일한 채널이 아니어야 한다는 규칙(DESIGN.md §2-3)은 그쪽에서 지켜진다.

    예전 주석이 여기서 `-700` 층을 따진 것은 이 줄이 등급어일 때의 이야기였다. 등급이
    빠졌으므로 본문 색(`text-fg`)이다 — 바로 위 `h2` 와 같은 토큰이라 카드 안에서
    제목과 값이 같은 계열로 선다.

    **`goldenLevel` 을 이 섹션이 더는 렌더하지 않는다.** 응답 필드는 그대로 받는다 —
    곡선 면(#656)도 문장(#637)도 `hourly` 를 근거로 쓰므로 화면에 소비처가 없어진 것이지
    계약이 바뀐 것이 아니다 (`골든타임-문구-세부명세.md` D9).

    **한 시각짜리 창에는 문장도 붙이지 않는다** (#200). 한 칸을 "내내" 라고 말할 수 없고,
    그 칸의 등급은 곡선 셀이 이미 색과 `sr-only` 로 전한다.
  */
  return (
    <div className="flex flex-col gap-1">
      <p className="text-title-1 text-fg font-bold tabular-nums">
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
  retryLabel = messages.common.retry,
}: {
  coverage: CodeNameMetadata | null
  onRetry?: (() => void) | undefined
  retryLabel?: string | undefined
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
          {retryLabel}
        </button>
      )}
    </div>
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
