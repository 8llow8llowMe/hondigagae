'use client'

import { Badge } from '@/components/badge'
import {
  CloudIcon,
  PartlyCloudyIcon,
  RainIcon,
  SleetIcon,
  SnowIcon,
  SunIcon,
  UmbrellaIcon,
} from '@/components/icons'
import { InfoTip } from '@/components/info-tip'
import { METRIC_FILL_TONE, MetricBadge, MetricValue } from '@/components/metric'
import { ScrollRailArrows, useScrollRail } from '@/components/scroll-rail'
import { Skeleton } from '@/components/skeleton'
import { Surface } from '@/components/surface'
import {
  regionTemperatureText,
  scoreBarPercent,
  soleRecommendedCode,
} from '@/lib/insight/region-cell'
import { sortRegionsByScore } from '@/lib/insight/region-order'
import { findTiedTop, type TiedTopRegions } from '@/lib/insight/region-tie'
import { suitabilityTone } from '@/lib/insight/tone'
import {
  resolveWeatherGlyph,
  type WeatherGlyphResolution,
  type WeatherIconKind,
} from '@/lib/insight/weather-icon'
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

  // 헤드라인이 `가장 나아요` 라고 말하는 날의 그 권역만 칸에 `추천` 을 단다 (#1068)
  const recommendedCode = soleRecommendedCode(data.regions, data.recommendedRegion)

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
      **점수의 뜻은 제목 옆 ⓘ 가, 만점은 점수 옆 `/100` 이 말한다** (#1065 · #1068). #638 은 배지가
      `100` 뿐이라 무엇의 100인지 화면 어디에도 없어서 제목 아래 상시 캡션(`반려견 활동 적합도 ·
      100점 만점`)을 세웠다. 그 목적 중 **만점**은 `56 /100` 이 칸마다 대신 말하고,
      **점수의 뜻**은 매일 읽을 문장이 아니라 원할 때 여는 설명이라 `InfoTip` 으로 옮겼다 —
      홈 첫 화면의 상시 글줄을 하나 줄인다.

      **하단으로 되돌리지 않는다** (#342 · #638). 표 아래 한 줄은 배지를 다 읽은 뒤에야 닿는다.
    */
    <Surface
      titleId="region-heading"
      title={messages.home.regionHeading}
      titleTrailing={
        /* 제목이 카드 왼쪽에서 시작하므로 말풍선은 오른쪽으로 편다 (`InfoTip` 의 `ALIGN`) */
        <InfoTip label={messages.home.regionScoreInfoLabel} align="start">
          {messages.home.regionScoreInfo}
        </InfoTip>
      }
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

        **152 였던 값을 176 으로 올렸다** (#412). 152 의 산식이 틀려 있었다 — **인셋은
        첫 칸에만 없다.** 둘째 칸부터는 `pl-3`(12) + `border-l`(1) 이 매번 들어가 값 자리가
        13px 줄었고, 당시 가로로 늘어선 `아이콘 · 숫자 · 배지` 세 자리가 그 13px 에서 접혔다.
        첫 칸만 멀쩡해 보여 더 늦게 드러났다.

        **좁은 폭은 한 단 아래다** (#530, `w-44` 176). 세로 목록을 걷고 모든 폭에서 가로
        레일이 되면서 375 의 가용폭 343 이 이 칸의 새 기준이 됐다 — 184 로 두면 둘째 칸이
        159px 만 보인다.

        **#1068 에서 칸 안이 세로 줄 넷이 됐다** (`이름 · 점수 · 막대 · 날씨`). 예전에는
        `아이콘 | 숫자 세 줄 | 배지` 가 **가로로** 한 줄에 서서 셋이 폭을 나눠 가졌고, 그래서
        숫자 자리(`w-20`/`lg:w-22`)와 배지 여백이 #412 · #638 · #1065 에서 번갈아 눌렸다.
        이제 줄마다 칸 폭(둘째 칸부터 163 · `lg` 171)을 **혼자** 쓴다 — 가장 넓은 줄
        (`☀ 24–31℃`, `서귀포권 [추천]`)도 100px 안팎이라 값이 칸을 다툴 일이 없다.
        산식은 `styles/overlay-and-region-cell.test.ts` 가, 실제 줄 수는
        `e2e/region-score-badge.spec.ts` 가 잡는다.

        **그래도 칸 폭은 그대로 둔다.** 폭은 값이 아니라 **레일**이 정한다 — 아래 1440 상한과
        375 의 둘째 칸이 그 기준이고, 칸 안이 여유로워졌다고 넓히면 그 둘이 깨진다.

        **상한은 187.4 다.** 1440 의 우측 열 가용폭이 953 이라 `(953−16)/5 = 187.4` 를
        넘기면 **1440 에서도 화살표가 남는다.** 184 는 936 이라 들어간다 (실측).

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
            <RegionRow
              key={region.region.code}
              item={region}
              recommended={region.region.code === recommendedCode}
            />
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
 * 이름 구분자는 ` · ` 다 — 이 저장소가 나열에 쓰는 기호다 (`goldenRunsJoin` 과 같다).
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
 * 권역 칸의 날씨 그림 — `DESIGN.md` §9-1 (2026-09-08 결정) (#314).
 *
 * **선 아이콘이다.** §9-1 이 이모지도 허용하지만 *"한 화면에서 이모지와 선 아이콘을 섞지
 * 않는다"* 고 못박았고, 홈에는 이미 선 아이콘만 서 있다 (병원 배너 · 시계 · 셰브론).
 * 이 자리에만 이모지를 두면 그 규칙을 이 화면이 어긴다.
 *
 * **날씨 전용 색을 쓴다** (#342). `--weather-*` 는 등급(`--metric-*`)과 다른 축이다 —
 * #314 는 배지와 같은 축으로 읽힐 것을 걱정해 무채색으로 갔지만, 다섯 칸을 훑을 때
 * 비 오는 권역을 찾는 것이 이 자리의 용도라 색이 그 일을 한다. 흐림만 색이 없다.
 *
 * **`sr-only` 로 서버 `name` 을 남긴다.** 아이콘은 스크린리더에 아무 말도 못 한다.
 *
 * **숫자를 대체하지 않는다.** 아이콘이 대신하는 것은 낱말(`맑음`)이지 `24–31℃` ·
 * `강수 0%` 같은 측정값이 아니다 (§9-1).
 */
function WeatherGlyph({ glyph }: { glyph: WeatherGlyphResolution }) {
  // 그림이 없는 코드는 서버 낱말을 그대로 적는다 — 빈 자리로 두지도, 틀린 그림을 그리지도 않는다
  if (glyph.kind === null) return <span>{glyph.name}</span>

  const Icon = WEATHER_ICONS[glyph.kind]

  /*
    **24px 이다** (§9 "24px 기본"). 16px 인라인이던 것을 키웠다 — 값 줄 안에 흐르는
    글자가 아니라 줄 왼쪽의 독립된 자리다.
  */
  return (
    <span className={cn('inline-flex shrink-0 items-center', WEATHER_COLORS[glyph.kind])}>
      <Icon size={24} />
      <span className="sr-only">{glyph.name}</span>
    </span>
  )
}

/**
 * 한 권역 칸 — **점수가 주인공이다** (#1068).
 *
 * 예전 칸은 `최고`·`최저`·`강수` 세 줄 옆에 작은 회색 배지(`56/100`)를 세워, 이 섹션이 답하는
 * "오늘 어디로" 의 답(점수)이 날씨 값보다 약하게 읽혔다. **글을 줄이지 않고 형태로 바꾼다** —
 * 정보는 그대로다: 점수 · 만점 · 등급(색 + 막대) · 하늘 · 기온 폭 · 강수.
 *
 * ```text
 * 서귀포권        [추천]    이름 (14/600) · 서버 추천 날의 단독 1위만 표시
 * 86 /100                   22/900 등급 색 -500 · 단위 12 --fg-muted  (MetricValue row)
 * ━━━━━━━━━━━━━━━░░░        3px 막대 — 길이 = 점수, 색 = 등급 -500, 트랙 --band
 * ☀ 24–31℃                  날씨 아이콘 24 · 14/600
 * ☂ 강수 10%                우산 16 · 12 --fg-muted
 * ```
 *
 * **점수가 없으면 "예보 없음" 이지 0 이 아니다.** 모르는 것과 나쁜 것을 구분하는 것이
 * 이 서비스의 규칙이라, 빈 자리를 0 으로 채우지 않는다 — 막대도 **점선**이라 0점의 빈 트랙과
 * 모양으로 갈린다 (DESIGN.md §2-3 `UNKNOWN`).
 */
function RegionRow({ item, recommended }: { item: RegionWeatherItem; recommended: boolean }) {
  const glyph = resolveWeatherGlyph(item.skyState, item.precipitationType)
  const temperature = regionTemperatureText(item.minTemperature, item.maxTemperature)
  const precipitation = item.maxPrecipitationProbability
  const hasSky = glyph !== null || temperature !== null

  return (
    /*
      세로 칸이다 — 위에서 아래로 줄 넷. 칸 사이는 왼쪽 1px 선이 잇고 첫 칸에는 두지 않는다.

      **줄마다 칸 폭을 혼자 쓴다** (#1068). 예전에는 `아이콘 | 숫자 | 배지` 가 가로로 한 줄에
      서서 폭을 나눠 가졌고, 배지가 넓어질 때마다 숫자 자리가 눌려 값 줄이 접혔다 (#412 ·
      #638 · #1065). 세로로 쌓으면 그 경쟁이 없다.
    */
    <li className="border-border/60 flex w-44 shrink-0 snap-start flex-col gap-2 border-l pl-3 first:border-l-0 first:pl-0 last:snap-end lg:w-46">
      <span className="flex items-center gap-2">
        <span className="text-body-2 min-w-0 font-semibold">{item.region.name}</span>
        {/*
          **서버 추천 날의 단독 1위에만 선다** (`soleRecommendedCode`). 경보 날 · 동점 날에는
          헤드라인이 한 곳을 가리키지 않으므로 칸도 가리키지 않는다.

          **등급 배지가 아니다.** 점수는 바로 아래 숫자가 말하고, 이것은 "서버가 고른 곳" 이라는
          표시라 `MetricBadge` 가 아니라 `Badge` 다. `ml-auto` 로 칸 오른쪽에 붙인다.
        */}
        {recommended && (
          <Badge tone="brand" size="sm" strong className="ml-auto shrink-0">
            {messages.home.regionRecommendedMark}
          </Badge>
        )}
      </span>

      <ScoreBlock score={item.weatherScore} />

      {/*
        **날씨 값은 두 줄이다** (#1068). `최고`·`최저` 두 줄을 `24–31℃` 한 줄로 합쳤다 — 기온
        표기는 #1067 의 "혼자 서는 값"(`formatStandaloneCelsius`)이다. 한쪽만 온 날에는 범위를
        만들 수 없어 그 값의 이름(`최고 31℃`)을 붙인다 (`regionTemperatureText`).

        값이 없으면 자리 자체가 없다 — 라벨만 남기지 않고, **다 없으면 감싼 자리도 내지 않는다.**
        빈 flex 항목을 남기면 칸의 `gap-2` 가 그 자리에도 붙는다 (예보 없는 `한라산권`).
      */}
      {(hasSky || precipitation !== null) && (
        <span className="flex flex-col gap-1">
          {hasSky && (
            <span className="text-body-2 flex items-center gap-2 font-semibold tabular-nums">
              {/*
                **다섯 칸을 훑을 때 낱말보다 픽토그램이 빠르다** (#314). `skyState` ·
                `precipitationType` 이 이미 응답에 오는데 화면이 둘 다 버리고 있었다.
              */}
              {glyph !== null && <WeatherGlyph glyph={glyph} />}
              {temperature !== null && <span>{temperature}</span>}
            </span>
          )}
          {precipitation !== null && (
            <span className="text-caption text-fg-muted flex items-center gap-1 font-medium tabular-nums">
              {/* 값의 이름표다 — 맑은 날에도 선다. 날씨 색을 받지 않는다 (`UmbrellaIcon`) */}
              <UmbrellaIcon size={16} />
              {messages.home.regionPrecipitation.replace('{percent}', String(precipitation))}
            </span>
          )}
        </span>
      )}
    </li>
  )
}

/**
 * 점수 한 줄 + 3px 막대 (#1068).
 *
 * **숫자는 22/900 등급 색 `-500` 이다** — DESIGN.md §2-3 *"등급 색을 숫자에 쓸 때는 22px 이상 +
 * weight 900 에만"*. 크기는 `MetricValue` 의 `row` 하나다 (§3-3 "행 안의 점수는 22/900"). 같은
 * 홈의 장소 적합도(`90 /100`)와 같은 컴포넌트라 두 점수가 같은 모양이다.
 *
 * **막대는 숫자가 이미 말한 값을 모양으로 한 번 더 보여 준다** — 다섯 칸을 훑을 때 길이가 숫자보다
 * 빨리 견줘진다. 색은 등급 면(`METRIC_FILL_TONE`, `-500` · 글자를 얹지 않는다)이고 트랙은 `--band`
 * 다. **`aria-hidden` 이다** — 새 정보가 아니라 바로 위 숫자의 그림이라, 보조기기에 두 번
 * 읽히지 않게 한다. §10 의 "진행률 링·게이지" 가 아니다: 링은 숫자를 **대신**하고, 이 막대는
 * 숫자 **옆**에서 §2-3 이 말한 "색 + 텍스트 + 지표 바" 의 한 채널이다.
 *
 * **예보가 없으면 점선이다** (§2-3 `UNKNOWN`). 0점은 빈 트랙(실선 면)이고 예보 없음은 점선이라
 * **색이 아니라 모양**으로 갈린다. 숫자 자리에는 `예보 없음` 을 적는다 — 0 을 쓰지 않는다.
 * 점선 색은 `--metric-unknown-500`(점선 전용 토큰)이다 — 선이 유일한 채널이 아니라 바로 위
 * 낱말이 뜻을 함께 말한다 (§2-3 "선 안에 글자가 있으면 이 규칙이 아니다" 와 같은 판단).
 *
 * **두 갈래의 높이가 같다.** 숫자 줄이 `title-1` 줄높이(30)라 `예보 없음` 배지도 같은 높이
 * 안에 앉혀 둔다 — 갈리면 칸마다 막대와 날씨 줄의 높이가 어긋나 다섯 칸이 열을 이루지 못한다.
 */
function ScoreBlock({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex h-7.5 items-center">
          <MetricBadge tone="unknown">{messages.home.regionScoreUnavailable}</MetricBadge>
        </span>
        <span
          aria-hidden
          className="border-metric-unknown-500 block h-0.75 w-full border-t-3 border-dashed"
        />
      </div>
    )
  }

  const tone = suitabilityTone(levelOf(score))

  /*
    **`div` 다.** `MetricValue` 가 `div` 를 렌더해 `span` 안에 두면 잘못된 중첩이다
    (`place-insight-row.tsx` 가 같은 이유로 적어 둔 자리).
  */
  return (
    <div className="flex flex-col gap-1">
      <MetricValue value={score} unit={messages.home.regionScoreUnit} tone={tone} />
      <span aria-hidden className="bg-band block h-0.75 w-full overflow-hidden rounded-full">
        <span
          className={cn('block h-full rounded-full', METRIC_FILL_TONE[tone])}
          // 길이가 곧 값이라 유틸리티로 적을 수 없다 — 0~100 을 %로 그대로 옮긴다
          style={{ width: `${scoreBarPercent(score)}%` }}
        />
      </span>
    </div>
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
 *
 * **높이를 실화면에 맞춘다** (#963). 1024 이상에서 홈 소개 카드가 이 섹션 바로 아래 첫 화면
 * 안에 서므로, 골격과 실화면의 높이 차가 곧 그 카드의 밀림이다. 마지막 칸이 `h-24` 이던 동안
 * 골격 206 · 실화면 267(768 이상, 375 는 198 · 277)이라 데이터가 오면 카드가 61px 내려갔다.
 * `h-40` 으로 270 · 262 — 밀림 −3 · 15.
 *
 * **#1068 에서 실화면이 다시 달라졌다** — 칸이 `이름 · 점수 · 막대 · 날씨 두 줄` 이 되면서
 * 280(768 이상) · 268(390). `h-40` 이면 768 이상에서 카드가 10px 밀려 `h-42` 로 278 · 270
 * (밀림 2 · −2)이다. 칸 구성을 바꾸면 이 값을 다시 잰다.
 */
export function RegionalWeatherSkeleton() {
  return (
    <Surface>
      <div aria-hidden className="flex flex-col gap-3 px-4 py-4 md:px-5 md:py-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-42 w-full" />
      </div>
    </Surface>
  )
}
