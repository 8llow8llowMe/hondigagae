'use client'

import {
  CloudIcon,
  PartlyCloudyIcon,
  RainIcon,
  SleetIcon,
  SnowIcon,
  SunIcon,
} from '@/components/icons'
import { MetricBadge } from '@/components/metric'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { Skeleton } from '@/components/skeleton'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatCelsius } from '@/lib/format/celsius'
import { sortRegionsByScore } from '@/lib/insight/region-order'
import { suitabilityTone } from '@/lib/insight/tone'
import { resolveWeatherGlyph, type WeatherIconKind } from '@/lib/insight/weather-icon'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'
import type { RegionalWeatherResponse, RegionWeatherItem } from '@/types/insight'

/**
 * 제주 권역 날씨 비교 — `GET /insights/regional-weather` (#158).
 *
 * **한라산이 섬을 기후로 갈라 놓는다는 것이 이 섹션의 전제다.** 같은 시각에 북부는 비가 오고
 * 남부는 개어 있는 일이 흔해, "제주 날씨" 를 한 값으로 말하면 그 차이가 사라진다.
 *
 * 이 섹션은 **"오늘 어디로"** 를 답한다. 그래서 좌측 맥락 레일이 아니라 **우측 열의
 * 최상단**에 선다 — 바로 아래 "오늘 ○○에게 맞는 곳" 이 같은 질문을 장소 단위로 좁혀
 * 답하므로, 권역(넓은 단위) → 장소(좁은 단위) 로 읽는 순서가 그대로 이어진다.
 *
 * **좌측에 두었던 것을 옮겼다.** DESIGN.md §7-1 이 좌측 레일을 "누구와(프로필) · 지금
 * 안전한가(판정) · 위급하면(병원)" 으로 정의하는데 이 섹션은 그 셋 중 어느 것도 아니고,
 * 레일이 1277px 로 부풀어 `lg:sticky` 가 뷰포트(936px)를 넘겨 무력화돼 있었다. 시간축
 * 판단(판정 · 골든타임)은 좌측에 그대로 남는다.
 *
 * **1024 이상에서 권역을 가로로 편다.** 우측 열은 1000px 급이라 4개를 세로로 쌓으면
 * 오른쪽이 비고 371px 를 세로로 먹는다. 가로 4칸이면 장소 목록의 범위 머리말처럼 읽힌다.
 */
export function RegionalWeatherSection({
  data,
  loading = false,
}: {
  data: RegionalWeatherResponse | null
  loading?: boolean
}) {
  // 훅은 early return 보다 위다 — 섹션이 뜨는 날과 숨는 날의 훅 순서가 달라지면 안 된다
  const rail = useScrollRail<HTMLUListElement>()

  // 조회 실패는 섹션을 통째로 숨긴다 — 홈의 최소 골격에 이 섹션은 없다 (공통명세 S4-1)
  if (data === null) return loading ? <RegionalWeatherSkeleton /> : null

  return (
    /*
      **위 테두리를 긋지 않는다.** 우측 열의 첫 블록이라 위에 이을 것이 없고, 2단에서는
      열 구분선(`border-left`)이 이미 이 블록의 왼쪽을 잡는다 (DESIGN.md §7-2).
      아래 밴드는 남긴다 — 다음이 "맞는 곳" 이라 다른 이야기가 시작된다 (§0).
    */
    <section aria-label={messages.home.regionHeading}>
      <div className="flex flex-col gap-3 px-4 py-4 md:px-10 md:py-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <h2 className="text-title-2 text-fg md:text-title-1 font-semibold md:font-bold">
            {messages.home.regionHeading}
          </h2>
          <WeatherWarningBadge warning={data.weatherWarning} />
        </div>

        <Recommendation data={data} />

        {/*
          **예보를 못 받은 권역도 남는다.** 목록에서 지우면 사용자는 그 권역이 조회되지
          않았다는 것조차 모른 채 "비교 대상이 넷" 이라고 읽는다.

          한 컬럼(~1023)은 전폭 행 + 1px 구분선이고, 2단(1024+)은 가로 칸 + 1px 세로
          구분선이다. 어느 쪽이든 묶음 안을 잇는 것은 선이다 (DESIGN.md §0).

          **칸 수를 고정하지 않는다** (`grid-cols-N` 이 아니라 `flex-1`). 권역 수는 서버가
          정한다 — dev 실측은 5개(제주시 · 서귀포 · 동부 · 서부 · 한라산)인데 4칸 grid 로
          두면 다섯째가 두 번째 줄로 떨어져 칸 높이가 두 배가 됐다. 늘거나 줄어도 한 줄이다.
        */}
        {/*
          **점수 높은 순이다** (`sortRegionsByScore`). 서버는 지리 순서로 주는데, 그대로
          두면 추천 권역이 어디 있을지 알 수 없다 — 실측에서 100점짜리가 맨 끝이었고
          바로 위 문장은 그 권역을 가리키고 있었다. 동점은 서버 순서를 지킨다.
        */}
        {/*
          **2단에서 칸을 쥐어짜지 않고 레일로 넘긴다** (#342). `lg:flex-1` 만 두면 칸이
          `min-w-0` 까지 줄어 1024~1280 에서 다섯 칸이 쪼그라들었다 — 값 묶음이 136px 를
          요구하는데 칸이 그보다 좁아지면 안에서 다시 접힌다.

          **`lg:min-w-38`(152px) 이 바닥이다.** 값 묶음 136px + 칸 인셋 12px = 148 에
          4px 여유다. `flex-1` 은 남는 폭을 나눠 갖고, 폭이 모자라면 이 바닥에서 멈춰
          `<ul>` 이 넘친다 → 가로 스크롤 + 화살표로 넘긴다.

          **160 이 아니라 152 인 이유**: 1280 의 우측 열 가용폭이 799px 이라 160×5 + gap 16
          = 816 이 17px 모자랐다. 그 17px 때문에 1280 에서까지 화살표가 남는다.
          152×5 + 16 = 776 이면 1280 은 넘김 없이 들어가고 1024(가용 543)는 그대로 넘긴다.

          한 컬럼(~1023)에서는 세로 목록이라 넘칠 폭이 없다 — `fade` 가 `none` 이고
          `ScrollRailArrows` 도 스스로 그리지 않는다.
        */}
        <div className="scroll-rail lg:min-w-0">
          <ul
            ref={rail.ref}
            onScroll={rail.onScroll}
            className={cn(
              'flex flex-col lg:flex-row lg:gap-x-1 lg:overflow-x-auto',
              // 스크롤바 자리는 fade 와 화살표가 대신한다 (`app/globals.css`)
              'scrollbar-none',
              rail.fadeClassName,
            )}
          >
            {sortRegionsByScore(data.regions).map((region) => (
              <RegionRow key={region.region.code} item={region} />
            ))}
          </ul>

          <ScrollRailArrows
            rail={rail}
            prevLabel={messages.home.regionRailPrev}
            nextLabel={messages.home.regionRailNext}
          />
        </div>
      </div>

      <div aria-hidden className="bg-band h-2 w-full" />
    </section>
  )
}

/**
 * 추천 권역.
 *
 * **없는 날에 "그나마 여기" 를 쓰지 않는다.** 특보 경보이거나 어느 권역도 예보를 못 받은
 * 날이고, 적합도는 0점·산책은 위험이라고 말하는 같은 서비스가 여기서만 나가라고 하면 안 된다
 * (`RegionalWeatherResponse` javadoc). 그때도 아래 비교표는 그대로 둔다 — 여전히 정보다.
 */
function Recommendation({ data }: { data: RegionalWeatherResponse }) {
  if (data.recommendedRegion === null) {
    return <p className="text-body-1 text-fg-muted font-semibold">{messages.home.regionNone}</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-body-1 font-semibold">
        {messages.home.regionRecommended.replace('{name}', data.recommendedRegion.name)}
      </p>
      {/*
        추천 이유는 **문장 배열**이다 (근거 객체가 아니다). 서버가 완성형으로 주므로
        FE 가 다시 쓰지 않는다 (styling-guide.md §7).
      */}
      {data.recommendationReasons.map((reason) => (
        <p key={reason} className="text-body-2 text-fg-muted">
          {reason}
        </p>
      ))}
    </div>
  )
}

/** 그림 종류 → 컴포넌트. 이 표에 없는 종류는 `resolveWeatherGlyph` 가 만들지 않는다 */
const WEATHER_ICONS: Record<WeatherIconKind, typeof SunIcon> = {
  sun: SunIcon,
  'partly-cloudy': PartlyCloudyIcon,
  cloud: CloudIcon,
  rain: RainIcon,
  snow: SnowIcon,
  sleet: SleetIcon,
}

/**
 * 그림 종류 → 색 — `DESIGN.md` §9-1 (2026-09-09 결정) (#342).
 *
 * **등급 색이 아니다.** `--weather-*` 는 하늘상태·강수형태 전용 축이고 점수·판정은
 * `--metric-*` 가 소유한다. 두 축을 섞지 않는다.
 *
 * **흐림(`cloud`)만 색이 없다** — 부모의 `--fg-muted` 를 물려받는다. 회색 구름이
 * 관습색이라 칠할 색이 따로 없고, 해가 안 보이는 것을 앰버로 그리면 틀린 그림이 된다.
 */
const WEATHER_COLORS: Record<WeatherIconKind, string> = {
  sun: 'text-weather-sun',
  'partly-cloudy': 'text-weather-sun',
  cloud: '',
  rain: 'text-weather-rain',
  sleet: 'text-weather-rain',
  snow: 'text-weather-snow',
}

/**
 * 권역 행의 날씨 그림 — `DESIGN.md` §9-1 (2026-09-08 결정) (#314).
 *
 * **선 아이콘이다.** §9-1 이 이모지도 허용하지만 *"한 화면에서 이모지와 선 아이콘을 섞지
 * 않는다"* 고 못박았고, 홈에는 이미 선 아이콘만 서 있다 (병원 배너 · 시계 · 셰브론).
 * 이 자리에만 이모지를 두면 그 규칙을 이 화면이 어긴다.
 *
 * **날씨 전용 색을 쓴다** (#342). `--weather-*` 는 등급(`--metric-*`)과 다른 축이다 —
 * #314 는 배지와 같은 축으로 읽힐 것을 걱정해 무채색으로 갔지만, 다섯 줄을 훑을 때
 * 비 오는 권역을 찾는 것이 이 자리의 용도라 색이 그 일을 한다. 흐림만 색이 없다.
 *
 * **`sr-only` 로 서버 `name` 을 남긴다.** 아이콘은 스크린리더에 아무 말도 못 한다.
 *
 * **숫자를 대체하지 않는다.** 아이콘이 대신하는 것은 낱말(`맑음`)이지 `최고 28.0℃` ·
 * `강수 0%` 같은 측정값이 아니다 (§9-1).
 */
function WeatherGlyph({ item }: { item: RegionWeatherItem }) {
  const glyph = resolveWeatherGlyph(item.skyState, item.precipitationType)

  if (glyph === null) return null

  // 그림이 없는 코드는 서버 낱말을 그대로 적는다 — 빈 자리로 두지도, 틀린 그림을 그리지도 않는다
  if (glyph.kind === null) return <span>{glyph.name}</span>

  const Icon = WEATHER_ICONS[glyph.kind]

  /*
    **24px 이다** (§9 "24px 기본"). 16px 인라인이던 것을 키웠다 — 값 줄 안에 흐르는
    글자가 아니라 행 왼쪽의 독립된 자리가 됐다.
  */
  return (
    <span className={cn('inline-flex shrink-0 items-center', WEATHER_COLORS[glyph.kind])}>
      <Icon size={24} />
      <span className="sr-only">{glyph.name}</span>
    </span>
  )
}

/**
 * 한 권역 행.
 *
 * **점수가 없으면 "예보 없음" 이지 0 이 아니다.** 모르는 것과 나쁜 것을 구분하는 것이
 * 이 서비스의 규칙이라, 빈 자리를 0 으로 채우지 않는다.
 */
function RegionRow({ item }: { item: RegionWeatherItem }) {
  const known = item.weatherScore !== null
  const maxTemperature = formatCelsius(item.maxTemperature)

  return (
    /*
      한 컬럼은 가로 행(이름 ↔ 값), 2단은 세로 칸(이름 위, 값 아래)이다. 2단에서 아래
      테두리를 걷고 왼쪽 테두리로 갈아 끼운다 — 첫 칸에는 선을 두지 않는다.
    */
    <li className="border-border/60 flex items-center justify-between gap-3 border-b py-2 last:border-b-0 lg:min-w-38 lg:flex-1 lg:flex-col lg:items-start lg:gap-1 lg:border-b-0 lg:border-l lg:py-0 lg:pl-3 lg:first:border-l-0 lg:first:pl-0">
      <span className="text-body-2 min-w-0 font-semibold">{item.region.name}</span>

      {/*
        **아이콘 / 숫자 / 배지 세 자리로 가른다** (#342). 숫자 두 값을 세로로 쌓는다.

        **이 배치가 2단 접힘을 푼다.** 예전에는 값 넷이 가로로 흘러 `아이콘 16 + 최고 62 +
        강수 52 + 배지 34 + gap 24 ≈ 188px` 를 요구했고, 2단(1024+) 칸이 실측 143~156px 라
        두 줄로 접혔다 (#314 이전부터 그랬다). 세로로 쌓으면 `아이콘 24 + 숫자 62 +
        배지 34 + gap 16 ≈ 136px` 로 줄어 한 줄에 들어간다.

        한 컬럼(~1023)에서는 행 높이가 39 → 약 48px 로 늘지만, 섹션 하단의 보조 문구 줄이
        함께 빠져(#342) 섹션 전체로는 거의 같다.
      */}
      <span className="text-caption text-fg-muted flex shrink-0 items-center gap-2 font-medium tabular-nums lg:w-full lg:shrink lg:justify-between">
        {/*
          **다섯 줄을 훑을 때 낱말보다 픽토그램이 빠르다** (#314). `skyState` · `precipitationType`
          이 이미 응답에 오는데 화면이 둘 다 버리고 있었다 — BE 작업 없이 붙일 수 있었다.
        */}
        <WeatherGlyph item={item} />

        {/*
          **숫자 두 값은 좌측 정렬로 쌓는다.** `최고` · `강수` 라벨이 줄머리에 서므로
          왼쪽이 읽는 기준선이다 — 우측 정렬로 두면 라벨이 들쭉날쭉해진다. 값의 자릿수는
          `tabular-nums`(부모가 준다)가 이미 맞춰 준다.

          **온도에 라벨을 붙인다** (#206). `maxTemperature` 인데 숫자만 두면 무슨 온도인지
          알 수 없다 — 바로 위 추천 문장(서버 완성형)은 "최고기온 26도" 라고 말한다.
          `minTemperature` 와 값이 같은 날이 많아 드러나지 않았을 뿐이다 (DESIGN.md §2-3).

          값이 없으면 자리 자체가 없다 — 라벨만 남기지 않고, **둘 다 없으면 감싼 자리도
          내지 않는다.** 빈 flex 항목을 남기면 부모의 `gap-2` 가 그 자리에도 붙어
          예보를 못 받은 권역(`한라산권`)의 배지가 8px 밀린다.

          그래서 배지는 `justify-between` 에 기대지 않고 `lg:ml-auto` 로 밀어 붙인다 —
          자식이 배지 하나뿐인 칸(`한라산권`)에서 `justify-between` 은 그것을 **왼쪽**에
          두고, 다섯 칸의 배지가 열을 이루지 못한다 (1280 실측: 넷은 우측 끝, 하나는 85px 앞).
        */}
        {(maxTemperature !== null || item.maxPrecipitationProbability !== null) && (
          <span className="flex flex-col items-start">
            {maxTemperature !== null && (
              <span>
                {messages.home.regionTempPrefix} {maxTemperature}℃
              </span>
            )}
            {item.maxPrecipitationProbability !== null && (
              <span>강수 {item.maxPrecipitationProbability}%</span>
            )}
          </span>
        )}

        {known ? (
          <MetricBadge
            tone={suitabilityTone(levelOf(item.weatherScore as number))}
            size="sm"
            className="lg:ml-auto"
          >
            {item.weatherScore}
          </MetricBadge>
        ) : (
          /* `unknown` 톤은 점선 테두리를 쓴다 — 0 점과 다른 모양이어야 한다 (DESIGN.md §2-3) */
          <MetricBadge tone="unknown" size="sm" className="lg:ml-auto">
            {messages.home.regionScoreUnavailable}
          </MetricBadge>
        )}
      </span>
    </li>
  )
}

/**
 * 점수 → 적합도 등급 코드. 백엔드 `SuitabilityLevel.from` 의 경계와 같아야 한다 — **80 / 60**.
 *
 * 서버가 권역 항목에 등급 metadata 를 주지 않아 FE 가 색만 매핑한다. **문구는 만들지 않는다** —
 * 화면에 나가는 것은 점수 숫자뿐이고, 등급 이름을 지어내면 서버가 말하지 않은 것을 말하게 된다.
 */
function levelOf(score: number): string {
  if (score >= 80) return 'HIGH'
  if (score >= 60) return 'MEDIUM'
  return 'LOW'
}

function RegionalWeatherSkeleton() {
  return (
    <section aria-hidden>
      <div className="flex flex-col gap-3 px-4 py-4 md:px-10 md:py-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="bg-band h-2 w-full" />
    </section>
  )
}
