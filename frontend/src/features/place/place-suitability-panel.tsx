import Link from 'next/link'

import { Badge } from '@/components/badge'
import { MetricValue, MetricWord } from '@/components/metric'
import { ReasonList } from '@/components/reason-list'
import { Skeleton } from '@/components/skeleton'
import { WeatherWarningBadge } from '@/components/weather-warning-badge'
import { formatDistance } from '@/lib/format/distance'
import { displayTemperature, supportingTemperatures } from '@/lib/insight/temperature'
import { suitabilityTone } from '@/lib/insight/tone'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { DailyWeatherItem, PlaceSuitabilityResponse } from '@/types/insight'

/**
 * 좌우 인셋 — `INSET_CLASS.card` 를 참조한다. 문자열을 이 파일에 다시 적지 않는다 (#386).
 *
 * **이 패널은 L1 카드 안의 L2 다** (`DESIGN.md §0`, #443). 예전에는 레일 인셋(`rail`, 40/24)
 * 이었는데 — 2a 에서 패널이 레일 열에 직접 놓였기 때문이다 — 3a 에서는 산책 위험도 · 하단
 * 바와 함께 **판정 카드 하나**에 들어가므로 카드 안 값(16/20)을 쓴다. 페이지 인셋을 카드
 * 안에서 쓰면 내용이 두 번 밀린다 (§0).
 */
const INSET = INSET_CLASS.card

export type PlaceSuitabilityPanelProps = {
  /** 조회 전이거나 실패면 null */
  data: PlaceSuitabilityResponse | null
  loading: boolean
  failed: boolean
  onRetry: () => void
  /** 선택된 반려견. **null 이면 판정의 화자가 없다** — 게스트 블록으로 갈린다 */
  petName: string | null
  /** 로그인 여부. 게스트 CTA 를 로그인으로 보낼지 반려견 등록으로 보낼지 가른다 */
  authed: boolean
}

/**
 * 적합도 판정 — 아트보드 `혼디가개 장소 상세` 01(모바일 본문 상단) · 03(데스크톱 좌측 레일).
 *
 * **이 화면이 존재하는 이유다.** 목록에 없던 점수·근거가 여기서 처음 나온다.
 *
 * 지키는 것:
 * - 화자는 반려견이다 — "몽실이에게 {서버 등급명}". 등급 문구를 FE 가 다시 쓰지 않는다
 * - 근거는 서버가 준 완성 문장을 **순서 그대로**. 재정렬하지 않고 `scoreDelta` 숫자를
 *   노출하지 않는다 (산식 비공개)
 * - **`score === null` 을 0 으로 렌더하지 않는다.** `INSUFFICIENT` 은 "나쁨" 이 아니라 "모름" 이다
 * - 언제·누구 기준인지 근거 아래 한 줄 — 예보 시각과 반려견이 바뀌면 값이 달라진다
 * - **반려견이 없으면 점수·근거·화자를 쓰지 않는다** (아트보드 04-③). 기준이 없기 때문이다
 */
export function PlaceSuitabilityPanel({
  data,
  loading,
  failed,
  onRetry,
  petName,
  authed,
}: PlaceSuitabilityPanelProps) {
  if (loading) return <PanelSkeleton />

  // 판정만 실패한 것이다. 화면 전체를 에러로 덮지 않는다 — 기본 정보는 그대로 쓸모가 있다
  if (failed || data === null) {
    return (
      <div className={cn('flex flex-col items-start gap-2 py-4', INSET)}>
        <p className="text-body-2 text-fg-muted">{messages.place.detailSuitabilityErrorTitle}</p>
        <button
          type="button"
          onClick={onRetry}
          // 높이 44 — 규칙이 아니라 이 자리에서 고른 값이다 (#883 이 §7 하한을 지도 타깃으로 좁혔다)
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.common.retry}
        </button>
      </div>
    )
  }

  if (petName === null) return <GuestBlock data={data} authed={authed} />

  const tone = suitabilityTone(data.suitabilityLevel.code)

  return (
    <div className={cn('flex flex-col gap-3 py-4', INSET)}>
      <div className="flex items-end justify-between gap-3">
        {/*
          특보 배지가 등급 줄에 함께 선다. **등급을 대신하지 않는다** — 경보면 등급이 이미
          "주의 필요" 로 내려와 있고, 배지는 그렇게 된 이유가 기상특보라는 것을 말한다.
          `flex-wrap` 은 긴 종류명("열대야 주의보")이 좁은 화면에서 등급 단어를 밀지 않게 한다.
        */}
        <p className="text-body-1 flex flex-wrap items-center gap-x-1 gap-y-2 font-semibold">
          <span className="text-fg-muted">
            {messages.place.detailSuitabilitySpeaker.replace('{name}', petName)}
          </span>
          <MetricWord tone={tone}>{data.suitabilityLevel.name}</MetricWord>
          <WeatherWarningBadge warning={data.weatherWarning} />
        </p>

        {/* null 은 0점이 아니라 "점수를 내지 않았다" 는 뜻이다. 자리를 0 으로 채우지 않는다 */}
        {data.score !== null && (
          <MetricValue
            value={data.score}
            unit={messages.place.detailScoreUnit}
            tone={tone}
            size="hero"
            className="shrink-0"
          />
        )}
      </div>

      {/*
        서버 순서를 유지한다. `reasons` 는 점수 영향이 큰 순서로 오고 그 순서가 곧 중요도다.
        정보성(`scoreDelta === 0`)만 한 단계 흐리게 내린다 — 감점이 아니기 때문이다.
      */}
      <ReasonList
        reasons={data.reasons.map((reason) => ({
          description: reason.description,
          informational: reason.scoreDelta === 0,
        }))}
      />

      <p className="text-caption text-fg-muted font-medium tabular-nums">
        {messages.place.detailSuitabilityBasis
          .replace('{date}', data.targetDate)
          .replace('{name}', petName)}
      </p>

      <IndoorAlternatives data={data} />
    </div>
  )
}

/**
 * 미로그인 · 반려견 미등록 — 아트보드 04-③.
 *
 * **점수·근거·"{이름}에게" 를 쓰지 않는다.** 기준이 되는 반려견이 없는데 판정을 말하면
 * 그 판정이 누구 것인지 알 수 없다. 지역 날씨만 보여주고 등록으로 보낸다.
 *
 * 아트보드가 여기에 적은 **체감 열지수는 이제 적합도 응답에 있다** — [PR #235](https://github.com/8llow8llowMe/hondigagae/pull/235)
 * 가 `weather.maxFeelsLikeTemperature` 를 더했다 (#253). 그전에는 없어서 최고기온으로
 * 대신하고 있었고, 지금은 **체감온도가 서고 못 받은 날에만 최고기온이 선다.**
 * 산책 위험도 응답의 `heatIndexCelsius` 와는 여전히 다른 값이다.
 */
function GuestBlock({ data, authed }: { data: PlaceSuitabilityResponse; authed: boolean }) {
  const weather = data.weather

  return (
    <div className={cn('flex flex-col gap-3 py-4', INSET)}>
      <p className="text-body-1 text-fg-muted font-semibold">{messages.place.detailGuestHeading}</p>

      {weather === null ? (
        <p className="text-body-2 text-fg-muted">{messages.place.detailGuestNoWeather}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-6">
            <TemperatureValue weather={weather} />
            {weather.maxPrecipitationProbability !== null && (
              <MetricValue
                label={messages.place.detailPrecipitationProbability}
                value={weather.maxPrecipitationProbability}
                unit={messages.place.detailPercentUnit}
              />
            )}
          </div>

          {/*
            **큰 숫자 아래 한 줄로 받친다** (#352). `MetricValue` 를 하나 더 세우지 않는다 —
            `lib/insight/temperature.ts` 가 *"둘을 나란히 세우지 않는다"* 고 정해 둔 자리다.
            같은 ℃ 짜리 큰 숫자가 둘이면 어느 쪽이 판정의 근거인지 라벨을 읽어야 알 수 있고,
            그 순간 이 자리의 성격("큰 숫자 하나")이 사라진다. 받치는 줄은 caption 이라
            큰 숫자와 경쟁하지 않는다.
          */}
          <TemperatureRange weather={weather} />
        </div>
      )}

      <div className="bg-band flex flex-col items-start gap-1 rounded-md p-3">
        <p className="text-body-2 text-fg">{messages.place.detailGuestCta}</p>
        <Link
          href={authed ? '/pets/new' : '/login'}
          // 높이 44 — 규칙이 아니라 이 자리에서 고른 값이다 (#883 이 §7 하한을 지도 타깃으로 좁혔다)
          className="text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center rounded-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {authed ? messages.place.detailGuestCtaPet : messages.place.detailGuestCtaSignup}
        </Link>
      </div>
    </div>
  )
}

/**
 * 미로그인 블록의 온도 — 체감온도, 없으면 최고기온 (#253).
 *
 * **일정 상세와 같은 규칙을 쓴다** (`lib/insight/temperature.ts`). 같은 값을 두 화면이
 * 다르게 고르면 사용자는 어느 쪽을 믿어야 할지 알 수 없다.
 *
 * **라벨이 `최고 체감온도` 인 이유** (#259): 이 값은 하루 최대인데, 바로 아래 산책 위험도가
 * 같은 체감온도를 **그 시각** 기준으로 낸다(`detailFeelsLike` = `체감온도`). 이 블록이 보이는
 * 것은 게스트 경로뿐인데 그때 두 숫자가 같은 ℃ 로 나란히 서므로, `최고` 가 없으면 어느
 * 쪽이 하루치인지 알 수 없다.
 */
function TemperatureValue({ weather }: { weather: DailyWeatherItem }) {
  const temperature = displayTemperature(weather)
  if (temperature === null) return null

  return (
    <MetricValue
      label={
        temperature.kind === 'feelsLike'
          ? messages.place.detailFeelsLikeTemperature
          : messages.place.detailMaxTemperature
      }
      value={temperature.value.toFixed(1)}
      unit={messages.place.detailTemperatureUnit}
    />
  )
}

/**
 * 큰 숫자를 받치는 최고·최저기온 한 줄 — #352.
 *
 * **응답에 이미 있던 값이다.** `weather.maxTemperature` · `weather.minTemperature` 가
 * 실려 오는데 화면이 둘 다 버리고 `최고 체감온도` 하나만 보여 주고 있었다 — 33.4℃ 만으로는
 * 아침에 나갈 수 있는 날인지 알 수 없다.
 *
 * **큰 숫자가 이미 최고기온이면 최고를 빼고 최저만 남긴다.** 중기예보 구간은 체감온도가
 * 없어 `displayTemperature` 가 최고기온을 큰 숫자로 세우고, 그때 여기서 다시 말하면 같은
 * 값이 한 자리에 두 번 선다. 판정은 `supportingTemperatures` 한 곳이 갖는다.
 *
 * **값이 없으면 줄 자체를 내지 않는다** — 라벨만 남은 줄을 두지 않는 이 화면의 규칙이다.
 */
function TemperatureRange({ weather }: { weather: DailyWeatherItem }) {
  const supporting = supportingTemperatures(weather, displayTemperature(weather))
  if (supporting.length === 0) return null

  return (
    <p className="text-caption text-fg-muted flex flex-wrap items-center gap-x-3 font-medium tabular-nums">
      {supporting.map((temperature) => (
        <span key={temperature.kind}>
          {temperature.kind === 'max'
            ? messages.place.detailSupportingMaxTemperature
            : messages.place.detailSupportingMinTemperature}{' '}
          {temperature.value.toFixed(1)}
          {messages.place.detailTemperatureUnit}
        </span>
      ))}
    </p>
  )
}

/** 비 예보일 때만 채워진다. **빈 배열이면 섹션을 렌더하지 않는다** */
function IndoorAlternatives({ data }: { data: PlaceSuitabilityResponse }) {
  if (data.indoorAlternatives.length === 0) return null

  return (
    <div className="border-border mt-1 flex flex-col gap-2 border-t pt-3">
      <p className="text-caption text-fg-muted font-semibold">
        {messages.place.detailIndoorAlternatives}
      </p>
      <ul className="flex flex-col gap-1">
        {data.indoorAlternatives.map((alternative) => (
          <li key={alternative.placeId}>
            <Link
              href={`/places/${alternative.placeId}`}
              className="text-body-2 text-fg hover:text-link focus-visible:ring-brand-500 inline-flex min-h-11 items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="font-semibold break-keep">{alternative.title}</span>
              {/* 거리는 중립 수치다 — 등급 색을 쓰지 않는다 (DESIGN.md §2-3) */}
              <span className="text-caption text-fg-muted tabular-nums">
                {formatDistance(alternative.distanceMeters)}
              </span>
              {/* 동반 가능 여부는 등급이 아니라 속성이다 — `MetricBadge` 를 쓰지 않는다 */}
              <Badge tone="neutral" size="sm">
                {alternative.petAllowanceType.name}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 실제 콘텐츠와 크기를 맞춰 레이아웃 점프를 막는다 (coding-conventions.md §6) */
function PanelSkeleton() {
  return (
    <div className={cn('flex flex-col gap-3 py-4', INSET)}>
      <div className="flex items-end justify-between gap-3">
        <Skeleton variant="text" className="h-7 w-40" />
        <Skeleton variant="text" className="h-9 w-16" />
      </div>
      <Skeleton variant="text" className="h-5 w-full" />
      <Skeleton variant="text" className="h-5 w-3/4" />
    </div>
  )
}
