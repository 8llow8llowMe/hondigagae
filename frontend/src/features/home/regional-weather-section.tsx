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
import { Skeleton } from '@/components/skeleton'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatCelsius } from '@/lib/format/celsius'
import { sortRegionsByScore } from '@/lib/insight/region-order'
import { suitabilityTone } from '@/lib/insight/tone'
import { resolveWeatherGlyph, type WeatherIconKind } from '@/lib/insight/weather-icon'
import { messages } from '@/lib/messages'
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
          <h2 className="text-body-1 font-semibold">{messages.home.regionHeading}</h2>
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
        <ul className="flex flex-col lg:flex-row lg:gap-x-1">
          {sortRegionsByScore(data.regions).map((region) => (
            <RegionRow key={region.region.code} item={region} />
          ))}
        </ul>

        <p className="text-caption text-fg-muted font-medium">{messages.home.regionScoreNote}</p>
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
 * 권역 행의 날씨 그림 — `DESIGN.md` §9-1 (2026-09-08 결정) (#314).
 *
 * **선 아이콘이다.** §9-1 이 이모지도 허용하지만 *"한 화면에서 이모지와 선 아이콘을 섞지
 * 않는다"* 고 못박았고, 홈에는 이미 선 아이콘만 서 있다 (병원 배너 · 시계 · 셰브론).
 * 이 자리에만 이모지를 두면 그 규칙을 이 화면이 어긴다.
 *
 * **등급 색을 쓰지 않는다.** 부모의 `text-fg-muted` 를 그대로 물려받는다 — 날씨는 판정이
 * 아니고, 같은 줄 오른쪽에 `--metric-*` 점수 배지가 서 있어 색이 겹치면 둘이 같은 축으로
 * 읽힌다.
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

  return (
    <span className="inline-flex shrink-0 items-center">
      <Icon size={16} />
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
    <li className="border-border/60 flex items-center justify-between gap-3 border-b py-2 last:border-b-0 lg:min-w-0 lg:flex-1 lg:flex-col lg:items-start lg:gap-1 lg:border-b-0 lg:border-l lg:py-0 lg:pl-3 lg:first:border-l-0 lg:first:pl-0">
      <span className="text-body-2 min-w-0 font-semibold">{item.region.name}</span>

      {/*
        **값 줄은 가로로 흐른다.** 세로로 쌓으면 칸이 불어나 권역을 가로로 편 이유가 사라진다.

        **한 컬럼(~1023)에서는 한 줄이다** — 실측 186px. 2단(1024+)의 칸은 실측 143~156px 라
        `최고 31.0℃ · 강수 10% · 배지` 가 두 줄로 접힌다. **이것은 #314 이전부터 그랬다**
        (아이콘을 붙이기 전후 값 줄이 143 × 36 으로 같다). 예전 주석은 "어느 폭에서도 한 줄,
        칸 237px" 이라고 적어 두었는데, 권역이 우측 열로 옮겨 오면서 칸이 좁아진 뒤로
        맞지 않는 값이었다.
      */}
      <span className="text-caption text-fg-muted flex shrink-0 items-center gap-2 font-medium tabular-nums">
        {/*
          **다섯 줄을 훑을 때 낱말보다 픽토그램이 빠르다** (#314). `skyState` · `precipitationType`
          이 이미 응답에 오는데 화면이 둘 다 버리고 있었다 — BE 작업 없이 붙일 수 있었다.
        */}
        <WeatherGlyph item={item} />

        {/*
          **온도에 라벨을 붙인다** (#206). `maxTemperature` 인데 숫자만 두면 무슨 온도인지
          알 수 없다 — 바로 위 추천 문장(서버 완성형)은 "최고기온 26도" 라고 말한다.
          `minTemperature` 와 값이 같은 날이 많아 드러나지 않았을 뿐이다 (DESIGN.md §2-3).
        */}
        {maxTemperature !== null && (
          <span>
            {messages.home.regionTempPrefix} {maxTemperature}℃
          </span>
        )}
        {item.maxPrecipitationProbability !== null && (
          <span>강수 {item.maxPrecipitationProbability}%</span>
        )}
        {known ? (
          <MetricBadge tone={suitabilityTone(levelOf(item.weatherScore as number))} size="sm">
            {item.weatherScore}
          </MetricBadge>
        ) : (
          /* `unknown` 톤은 점선 테두리를 쓴다 — 0 점과 다른 모양이어야 한다 (DESIGN.md §2-3) */
          <MetricBadge tone="unknown" size="sm">
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
