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
import { Surface } from '@/components/surface'
import { formatCelsius } from '@/lib/format/celsius'
import { sortRegionsByScore } from '@/lib/insight/region-order'
import { findTiedTop, type TiedTopRegions } from '@/lib/insight/region-tie'
import { suitabilityTone } from '@/lib/insight/tone'
import { resolveWeatherGlyph, type WeatherIconKind } from '@/lib/insight/weather-icon'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { CodeNameMetadata } from '@/types/api'
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
 * **모든 폭에서 권역을 가로로 편다** (#530). 1024 이상만 가로였는데, **권역은 서로
 * 견주라고 있는 표다** — 세로로 세우면 값이 한 번에 한 권역만 보여 비교가 안 되고,
 * 좁은 폭일수록 카드 한 장이 화면의 5분의 1을 먹는다. 비교가 목적인 표에서 "좁으니까
 * 세로로 쌓는다" 는 그 목적을 폭에 따라 버리는 것이다.
 *
 * 가로 레일의 장치(스냅 · 우측 페이드 · 화살표)는 `.scroll-rail` 이 이미 갖고 있어
 * 폭에 따라 새로 만들 것이 없다 — 1024 이상에서만 쓰던 것을 아래로 내렸을 뿐이다.
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
      **아래 밴드가 사라졌다** (#428). 3a 에서는 카드 사이 간격이 경계라, 섹션이 스스로
      다음과의 경계를 그릴 필요가 없다 — 다음 섹션이 없는 날(조회 실패)에 밴드만 남던
      문제도 함께 없어진다.

      **특보 배지가 여기 없다** (#349). 페이지 최상단 `WeatherWarningStrip` 하나가
      말한다. 예전에는 이 배지가 **모바일의 유일한 특보 표시**를 겸했는데, 스트립이
      레이아웃 밖 최상단이라 그 역할까지 함께 가져갔다.
    */
    /*
      **제목 아래 캡션이 점수의 뜻과 만점을 밝힌다** (#638). 배지가 `100` 뿐이던 동안에는
      무엇의 100인지 화면 어디에도 없었다 — #342 는 "배지가 날씨 값 바로 옆이라 자리가
      말한다" 고 보고 보조 문구를 걷었는데, 값 묶음이 세로로 쌓이면서 배지가 숫자에서
      떨어져(`ml-auto`) 그 전제가 무너졌다.

      **하단이 아니라 머리다.** 표 아래 한 줄은 배지를 다 읽은 뒤에야 닿는다.
      `Surface` 가 이미 받는 `description` 자리라 새 자리를 만들지 않는다.
    */
    <Surface
      titleId="region-heading"
      title={messages.home.regionHeading}
      description={messages.home.regionScoreCaption}
    >
      <div className={cn('pb-3', INSET_CLASS.card)}>
        <Recommendation data={data} />
      </div>

      {/*
        **표 위에 1px 선을 넣는다** (#530). 추천 문장과 비교표는 같은 인셋의 본문 글줄이라
        선이 없으면 한 덩어리로 읽혔다 — 위는 **서버가 고른 답**이고 아래는 **그 답을
        견주는 근거**다. 묶음 안을 잇는 것은 선이다 (DESIGN.md §0).
      */}
      {/*
        **예보를 못 받은 권역도 남는다.** 목록에서 지우면 사용자는 그 권역이 조회되지
        않았다는 것조차 모른 채 "비교 대상이 넷" 이라고 읽는다.

        **칸 수를 고정하지 않는다** (`grid-cols-N` 을 쓰지 않는다). 권역 수는 서버가
        정한다 — dev 실측은 5개(제주시 · 서귀포 · 동부 · 서부 · 한라산)인데 4칸 grid 로
        두면 다섯째가 두 번째 줄로 떨어져 칸 높이가 두 배가 됐다. 늘거나 줄어도 한 줄이다.
      */}
      {/*
        **점수 높은 순이다** (`sortRegionsByScore`). 서버는 지리 순서로 주는데, 그대로
        두면 추천 권역이 어디 있을지 알 수 없다 — 실측에서 100점짜리가 맨 끝이었고
        바로 위 문장은 그 권역을 가리키고 있었다. 동점은 서버 순서를 지킨다.
      */}
      {/*
        **칸을 쥐어짜지 않고 레일로 넘긴다** (#342). 칸이 `min-w-0` 까지 줄면 다섯 칸이
        쪼그라든다 — 값 묶음이 136px 를 요구하는데 칸이 그보다 좁아지면 안에서 다시 접힌다.

        **폭은 고정이다** (`w-44` 176 / `lg:w-46` 184). 예전에는 `lg:min-w-38 lg:flex-1` 이라
        **폭에 따라 152~191 사이를 오갔고**, 1170 같은 중간 폭에서 바닥값으로 내려앉은 채
        마지막 칸이 65px 만 보이며 잘렸다 (#395). 폭이 뷰포트마다 달라지면 같은 칸이
        화면마다 다른 물건처럼 보이고, 잘린 칸은 "더 있다" 가 아니라 "깨졌다" 로 읽힌다.

        **152 였던 값을 176 으로 올렸다** (#412). 152 의 산식이 틀려 있었다 — "값 묶음
        136 + 칸 인셋 12 = 148 에 4px 여유" 라고 적었는데, **인셋은 첫 칸에만 없다.**
        둘째 칸부터는 `pl-3`(12) + `border-l`(1) 이 매번 들어가 값 자리가
        **78.6 → 65.6px** 로 줄었다. 가장 넓은 줄 `최고 31.0℃` 가 62.9px 이라 남는 것이
        **2.7px** 이었고, 폰트 렌더링이 조금만 달라지면 `최고` 와 `27.0℃` 사이에서 줄이
        접혀 칸 높이가 배로 뛰었다. 첫 칸만 멀쩡해 보여 더 늦게 드러났다.

        **184 의 산식**: 인셋 13 + 아이콘 24 + gap 8 + 숫자 자리 88 + gap 8 + 배지 41.4
        = 182.4. 숫자 자리를 `lg:w-22`(88px)로 **고정**해 62.9px 짜리 줄에 25px 여유를
        둔다 — 이 여유가 폰트가 달라져도 접히지 않게 하는 몫이다.

        **좁은 폭은 한 단 아래다** (#530, `w-44` 176 + 숫자 자리 `w-20` 80). 세로 목록을
        걷고 모든 폭에서 가로 레일이 되면서 375 의 가용폭 343 이 이 칸의 새 기준이 됐다 —
        184 로 두면 둘째 칸이 159px 만 보인다. **둘은 반드시 함께 내린다**: 칸만 줄이면
        숫자 자리 88 이 174.4 를 요구해 값 줄이 조용히 접힌다 (위 #412 의 재발이다).
        80 도 62.9px 짜리 줄에 17.1px 을 남긴다.

        **배지가 41.4 인 것은 `size="score"`(px-3) 때문이다.** 숫자만 담는 배지라
        낱말용 8px 에서는 조여 보였다 (`components/metric.tsx`). 배지를 더 키우면
        **숫자 자리가 눌린다** — `w-20`/`lg:w-22` 는 하한이 아니라 상한이라, 남는 폭이
        모자라면 조용히 줄어든다. 그래서 이 둘은 함께 움직여야 하고 테스트가 그 관계를 잡는다.

        **상한은 187.4 다.** 1440 의 우측 열 가용폭이 953 이라 `(953−16)/5 = 187.4` 를
        넘기면 **1440 에서도 화살표가 남는다.** 184 는 936 이라 들어간다 (실측).
        배지를 `px-4`(49.4)로 키우면 필요 폭이 190.4 가 되어 이 상한을 넘는다.

        **1280 에서는 화살표가 남는다.** `184×5 + gap 4×4 = 936` 이 1280 의 가용폭 793 을
        넘긴다 — #395 는 이것을 피하려고 152 를 골랐지만, 그 선택이 지키려던 "한 줄"
        자체가 깨지고 있었다. **접히는 칸보다 화살표가 낫다.** 1280 을 화살표 없이
        채우려면 칸이 155px 이하여야 하는데(`(793−16)/5`), 그 폭으로는 접힘을 못 막는다 —
        두 조건은 동시에 만족할 수 없다.
      */}
      <div className={cn('scroll-rail border-border border-t py-3 md:py-4', INSET_CLASS.card)}>
        <ul
          ref={rail.ref}
          onScroll={rail.onScroll}
          className={cn(
            'flex gap-x-1 overflow-x-auto',
            // 스크롤바 자리는 fade 와 화살표가 대신한다 (`app/globals.css`)
            'scrollbar-none',
            /*
              **칸이 중간에서 잘린 채 멈추지 않게 한다** (#395). 고정 폭이라 어느 위치에서
              멈추든 칸 모양은 같지만, 멈추는 자리가 칸 경계가 아니면 마지막 칸이 반쯤
              보인 채 남아 "더 있다" 가 아니라 "깨졌다" 로 읽힌다.

              **마지막 칸만 `snap-end` 다.** 스냅 지점이 칸 시작(0 · 180 · 360 …)뿐이면
              넘치는 폭이 칸 하나보다 작을 때(1170 실측 87px < 152) 0 말고는 닿을 자리가
              없어 **마지막 칸을 끝까지 볼 수 없다.** 마지막 칸의 끝을 컨테이너 끝에
              맞추면 그 자리가 곧 `maxScroll` 이라 한 번 넘기면 통째로 드러난다.

              1170 실측: `scrollTo(87)` → 87 에 눕고 마지막 칸이 완전히 보인다.
              중간(`40`)으로 밀면 0 으로 되돌아온다 — **칸 중간에서 멈추지 않는다**는 것이
              이 규칙의 전부다.

              **`lg:` 한정을 걷었다** (#530). 그 아래가 세로 목록이던 동안에는 가로로 스냅할
              축이 없었는데, 이제 모든 폭이 같은 레일이라 규칙도 하나다.
            */
            'snap-x snap-mandatory',
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
    </Surface>
  )
}

/**
 * 추천이 없는 날의 사유 (#905 R2).
 *
 * **판정을 다시 하지 않는다.** 서버가 추천을 비우는 경우는 둘뿐이고(`RegionalWeatherResponse`
 * 주석) 응답에 이미 드러난 사실로 어느 쪽인지 가른다 — 경보 여부를 `level.code` 로 다시 세우지
 * 않는다 (백엔드 #357: 소비 측이 `WARNING` 비교를 다시 쓰면 규칙이 두 곳으로 갈라진다).
 *
 * **특보가 있어도 점수 있는 권역이 하나도 없으면 예보 쪽이다.** 주의보가 떠 있는 날 예보까지
 * 못 받았다면 추천이 빈 이유는 예보이고, 그때 "경보가 발효 중" 이라고 말하면 거짓이 된다.
 * 점수 있는 권역이 있는데도 추천이 비었다면 남는 이유는 경보뿐이다.
 */
function noneReason(data: RegionalWeatherResponse): string {
  const anyScored = data.regions.some((region) => region.weatherScore !== null)

  return data.weatherWarning !== null && anyScored
    ? messages.home.regionNoneWarning
    : messages.home.regionNoneForecast
}

/**
 * 추천 권역.
 *
 * **없는 날에 "그나마 여기" 를 쓰지 않는다.** 특보 경보이거나 어느 권역도 예보를 못 받은
 * 날이고, 적합도는 0점·산책은 위험이라고 말하는 같은 서비스가 여기서만 나가라고 하면 안 된다
 * (`RegionalWeatherResponse` javadoc). 그때도 아래 비교표는 그대로 둔다 — 여전히 정보다.
 *
 * **동점이면 1위를 단정하지 않는다** (#638). 2026-09-15 실측에서 다섯 배지가 전부 `100`
 * 인데 이 문장은 "오늘은 제주시권이 가장 나아요" 였다 — 바로 아래 표가 그 말을 받쳐 주지
 * 못하면 사용자는 자기가 표를 잘못 읽었다고 생각한다. 판정은 `findTiedTop` 이 한다.
 */
function Recommendation({ data }: { data: RegionalWeatherResponse }) {
  if (data.recommendedRegion === null) {
    /*
      **여기서는 동점을 세지 않는다.** 서버가 추천을 내지 않은 날이라, 점수가 같은 권역을
      찾아 "어디든 좋아요" 라고 말하면 서버가 막아 둔 문을 화면이 다시 여는 것이 된다.
    */
    return (
      <div className="flex flex-col gap-1">
        <p className="text-body-1 text-fg-muted font-semibold">{messages.home.regionNone}</p>
        {/*
          **사유를 한 줄 붙인다** (#905 R2). 한 줄만 두면 바로 아래 표의 점수 배지와
          모순처럼 읽혔다 — "점수는 86인데 추천할 곳이 없다고?".
        */}
        <p className="text-body-2 text-fg-muted">{noneReason(data)}</p>
      </div>
    )
  }

  const tied = findTiedTop(data.regions, data.recommendedRegion)

  return (
    <div className="flex flex-col gap-1">
      {/*
        **문장이 바꾸는 것은 "어디가" 뿐이다.** 아래 `recommendationReasons` 는 서버가 준
        완성형 근거라 동점이든 아니든 그대로 붙는다 — 그쪽이 "왜 좋은가" 를 말한다.
      */}
      <p className="text-body-1 font-semibold">{headline(data.recommendedRegion, tied)}</p>
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

/**
 * 추천 문장 한 줄 (#638).
 *
 * **동점이 2곳 이상일 때만 갈린다.** 1곳이면 그것이 곧 단독 1위라 현행 문장 그대로다.
 *
 * **전부 동점이면 이름을 나열하지 않는다.** 다섯을 늘어놓아도 "고를 것이 없다" 는 뜻은
 * 같은데 줄만 길어진다.
 *
 * 이름 구분자는 ` · ` 다 — 같은 카드의 다른 문장(캡션)과 같은 기호를 쓴다.
 */
function headline(recommended: CodeNameMetadata, tied: TiedTopRegions): string {
  if (tied.regions.length < 2) {
    return messages.home.regionRecommended.replace('{name}', recommended.name)
  }

  if (tied.isAll) return messages.home.regionTiedAll

  return messages.home.regionTied.replace(
    '{names}',
    tied.regions.map((item) => item.region.name).join(' · '),
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
  const minTemperature = formatCelsius(item.minTemperature)
  const hasNumbers =
    maxTemperature !== null || minTemperature !== null || item.maxPrecipitationProbability !== null

  return (
    /*
      세로 칸이다 — 이름 위, 값 아래. 칸 사이는 왼쪽 1px 선이 잇고 첫 칸에는 두지 않는다.

      **한 컬럼용 가로 행 변형을 걷었다** (#530). 그 형태는 이름 ↔ 값을 양끝으로 벌린
      전폭 행이라 값끼리 세로로 줄을 서지 않았고, **권역을 서로 견주는 일**을 좁은 폭에서만
      포기하고 있었다.
    */
    <li className="border-border/60 flex w-44 shrink-0 snap-start flex-col items-start gap-1 border-l pl-3 first:border-l-0 first:pl-0 last:snap-end lg:w-46">
      <span className="text-body-2 min-w-0 font-semibold">{item.region.name}</span>

      {/*
        **아이콘 / 숫자 / 배지 세 자리로 가른다** (#342). 숫자 두 값을 세로로 쌓는다.

        **이 배치가 칸 접힘을 푼다.** 예전에는 값 넷이 가로로 흘러 `아이콘 16 + 최고 62 +
        강수 52 + 배지 34 + gap 24 ≈ 188px` 를 요구했고, 칸이 실측 143~156px 라 두 줄로
        접혔다 (#314 이전부터 그랬다). 세로로 쌓으면 `아이콘 24 + 숫자 62 + 배지 34 +
        gap 16 ≈ 136px` 로 줄어 한 줄에 들어간다.

        **숫자 줄이 둘에서 셋으로 늘었다** (#352, 최저기온). 가장 넓은 줄은
        `최고 31.0℃`(62.9px)이고 `최저 24.0℃` 도 같은 폭이라 늘어난 것은 높이뿐이다.

        **그때 잰 `79px` 는 첫 칸 값이었다** (#412). 나머지 네 칸은 인셋 13px 이 더 빠져
        65.6px 이고, 62.9px 짜리 줄에 2.7px 만 남아 있었다. 지금은 숫자 자리를
        `w-20`(80) / `lg:w-22`(88)로 고정해 어느 칸에서도 같은 폭이다.
      */}
      <span className="text-caption text-fg-muted flex w-full items-center gap-2 font-medium tabular-nums">
        {/*
          **다섯 줄을 훑을 때 낱말보다 픽토그램이 빠르다** (#314). `skyState` · `precipitationType`
          이 이미 응답에 오는데 화면이 둘 다 버리고 있었다 — BE 작업 없이 붙일 수 있었다.
        */}
        <WeatherGlyph item={item} />

        {/*
          **숫자 세 값은 좌측 정렬로 쌓는다.** `최고` · `최저` · `강수` 라벨이 줄머리에
          서므로 왼쪽이 읽는 기준선이다 — 우측 정렬로 두면 라벨이 들쭉날쭉해진다. 값의
          자릿수는 `tabular-nums`(부모가 준다)가 이미 맞춰 준다.

          **온도에 라벨을 붙인다** (#206). `maxTemperature` 인데 숫자만 두면 무슨 온도인지
          알 수 없다 — 바로 위 추천 문장(서버 완성형)은 "최고기온 26도" 라고 말한다.
          `minTemperature` 와 값이 같은 날이 많아 드러나지 않았을 뿐이다 (DESIGN.md §2-3).

          값이 없으면 자리 자체가 없다 — 라벨만 남기지 않고, **셋 다 없으면 감싼 자리도
          내지 않는다.** 빈 flex 항목을 남기면 부모의 `gap-2` 가 그 자리에도 붙어
          예보를 못 받은 권역(`한라산권`)의 배지가 8px 밀린다.

          그래서 배지는 `justify-between` 에 기대지 않고 `ml-auto` 로 밀어 붙인다 —
          자식이 배지 하나뿐인 칸(`한라산권`)에서 `justify-between` 은 그것을 **왼쪽**에
          두고, 다섯 칸의 배지가 열을 이루지 못한다 (1280 실측: 넷은 우측 끝, 하나는 85px 앞).

          **그래서 `justify-between` 을 걷었다** (#412). `ml-auto` 가 남는 공간을 전부
          먹어 버리므로 `justify-between` 은 애초에 발동할 자리가 없다 — 실측으로 확인했다
          (빼도 다섯 칸의 배지 우측 끝이 617·797·977·1157·1337 로 한 픽셀도 안 움직인다).
          같은 일을 두 규칙이 하면 나중에 어느 쪽을 고쳐야 하는지 알 수 없다.

          **`ml-auto` 는 반대로 필수다.** 함께 걷으면 `한라산권` 배지가 1337 → 1236 으로
          100px 어긋난다. 이 칸만 아이콘도 숫자도 없어 배지가 곧 첫 자식이기 때문이다.

          **남는 공간을 줄이는 쪽으로 고쳤다.** 칸이 184 가 되면서 `ml-auto` 가 먹는 틈이
          34.7px 까지 벌어져 배지가 숫자에서 떨어져 보였다 — 숫자 자리를 88px 로 고정해
          9.6px 로 되돌렸다 (152 시절의 10.7px 과 같은 밀도다). 좁은 폭(176 + 80)도 같은
          9.6px 이다 — 칸과 숫자 자리를 **같이** 한 단 내렸기 때문이다.
        */}
        {hasNumbers && (
          <span className="flex w-20 flex-col items-start lg:w-22">
            {maxTemperature !== null && (
              <span>
                {messages.home.regionTempPrefix} {maxTemperature}℃
              </span>
            )}
            {/*
              **최저기온은 최고 바로 아래다** (#352). 서버가 이미 주고 있던 값인데 화면이
              버리고 있었다 — 하루 폭을 모르면 최고 31.0℃ 가 몇 시의 이야기인지 알 수 없다.

              **접두가 `최고`/`최저` 로 길이가 같아** 두 줄의 숫자 왼쪽 끝이 맞는다.
              값이 없으면 이 줄만 빠지고 최고·강수는 그대로 선다.
            */}
            {minTemperature !== null && (
              <span>
                {messages.home.regionMinTempPrefix} {minTemperature}℃
              </span>
            )}
            {item.maxPrecipitationProbability !== null && (
              <span>강수 {item.maxPrecipitationProbability}%</span>
            )}
          </span>
        )}

        {known ? (
          <MetricBadge
            size="score"
            tone={suitabilityTone(levelOf(item.weatherScore as number))}
            className="ml-auto"
          >
            {/*
              **단위를 붙인다** (#638). 숫자만 두면 개수인지 순위인지 점수인지 배지가
              말하지 못한다 — 만점은 카드 캡션이 말하고 여기서는 한 글자만 붙인다.
            */}
            {messages.home.regionScoreUnit.replace('{score}', String(item.weatherScore))}
          </MetricBadge>
        ) : (
          /* `unknown` 톤은 점선 테두리를 쓴다 — 0 점과 다른 모양이어야 한다 (DESIGN.md §2-3) */
          <MetricBadge tone="unknown" className="ml-auto">
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

/**
 * **스켈레톤도 같은 표면을 쓴다** (#428). 로딩과 완료가 다른 표면을 쓰면 데이터가
 * 도착하는 순간 카드가 생겼다 사라진 것처럼 보인다.
 *
 * **홈 `loading.tsx` 도 이것을 그린다** (#907) — 권역 비교는 클라이언트가 조회하므로
 * 폴백이 풀린 직후에도 이 골격이 서 있다. 두 벌로 두면 그 순간 카드 높이가 갈린다.
 */
export function RegionalWeatherSkeleton() {
  return (
    <Surface>
      <div aria-hidden className="flex flex-col gap-3 px-4 py-4 md:px-5 md:py-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-24 w-full" />
      </div>
    </Surface>
  )
}
