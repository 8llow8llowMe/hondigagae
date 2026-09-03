'use client'

import { MetricBadge } from '@/components/metric'
import { Skeleton } from '@/components/skeleton'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatCelsius } from '@/lib/format/celsius'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import type { RegionalWeatherResponse, RegionWeatherItem } from '@/types/insight'

/**
 * 제주 권역 날씨 비교 — `GET /insights/regional-weather` (#158).
 *
 * **한라산이 섬을 기후로 갈라 놓는다는 것이 이 섹션의 전제다.** 같은 시각에 북부는 비가 오고
 * 남부는 개어 있는 일이 흔해, "제주 날씨" 를 한 값으로 말하면 그 차이가 사라진다.
 *
 * 바로 위 골든타임이 **"오늘 언제"** 를 답하고 이 섹션이 **"오늘 어디로"** 를 답한다.
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
    <section aria-label={messages.home.regionHeading} className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <h2 className="text-body-1 font-semibold">{messages.home.regionHeading}</h2>
          <WeatherWarningBadge warning={data.weatherWarning} />
        </div>

        <Recommendation data={data} />

        {/*
          **예보를 못 받은 권역도 남는다.** 목록에서 지우면 사용자는 그 권역이 조회되지
          않았다는 것조차 모른 채 "비교 대상이 넷" 이라고 읽는다.
        */}
        <ul className="flex flex-col">
          {data.regions.map((region) => (
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
    <li className="border-border/60 flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="text-body-2 min-w-0 font-semibold">{item.region.name}</span>

      <span className="text-caption text-fg-muted flex shrink-0 items-center gap-2 font-medium tabular-nums">
        {maxTemperature !== null && <span>{maxTemperature}℃</span>}
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
    <section aria-hidden className="border-border border-t">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="bg-band h-2 w-full" />
    </section>
  )
}
