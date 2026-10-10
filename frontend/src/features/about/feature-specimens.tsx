import { MetricBadge } from '@/components/metric'
import {
  INDOOR_SPECIMEN,
  SUITABILITY_SPECIMEN,
  WEATHER_SPECIMEN,
} from '@/features/about/about-specimen-data'
import { Tag } from '@/features/about/tag'
import { messages } from '@/lib/messages'
import { cn } from '@/lib/utils/cn'

/**
 * 질문 3 의 서버 예시 둘 — 여행 적합도 · 비가 오면 실내로 (#940).
 *
 * **실제 응답의 모양을 그대로 옮긴다.** 적합도는 `PlaceSuitabilityResponse`(근거 `name` + 완성
 * 문장 · 날씨 요약 · 혼잡도 · 반영 조건 `*Applied`), 실내 대안은 `AlternativePlaceItem`(이름 ·
 * 거리 · 동반 형태 · 동반 크기)이다. 값은 `about-specimen-data.ts`, 문장은 `messages.about.specimen`.
 * 예전 적합도 예시는 장소 · 배지 · 문장 둘뿐이라 네 예시 가운데 가장 낮았다.
 */
export function SuitabilitySpecimen() {
  const copy = messages.about.specimen
  const facts = [
    { label: copy.suitabilityFeelsLike, value: SUITABILITY_SPECIMEN.feelsLike },
    { label: copy.suitabilityRain, value: SUITABILITY_SPECIMEN.rain },
    { label: copy.suitabilityCongestion, value: SUITABILITY_SPECIMEN.congestion },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body-1 text-fg font-semibold">{SUITABILITY_SPECIMEN.place}</p>
          <p className="text-caption text-fg-muted mt-1 font-medium">
            {copy.suitabilityMeta
              .replace('{date}', SUITABILITY_SPECIMEN.date)
              .replace('{pet}', SUITABILITY_SPECIMEN.pet)}
          </p>
        </div>
        <MetricBadge tone="high" axis="suitability">
          {copy.suitabilityGrade}
        </MetricBadge>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-band rounded-md px-3 py-2">
            <dt className="text-caption text-fg-muted font-medium">{fact.label}</dt>
            <dd className="text-body-1 text-fg mt-1 font-semibold tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="border-border mt-3 grid gap-2 border-t pt-3">
        {copy.suitabilityReasons.map((reason) => (
          <li key={reason.name} className="flex gap-2">
            <span aria-hidden className="bg-fg-muted mt-2 size-1.5 shrink-0 rounded-full" />
            <p className="text-body-2 text-fg break-keep">
              <span className="font-semibold">{reason.name}</span>
              <span className="text-fg-muted"> · {reason.description}</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-caption text-fg-muted font-semibold">
          {copy.suitabilityAppliedLabel}
        </span>
        {copy.suitabilityApplied.map((item) => (
          <Tag key={item} tone="open">
            {item}
          </Tag>
        ))}
      </div>
      <p className="text-caption text-fg-muted mt-3 font-medium">{copy.suitabilityNote}</p>
    </div>
  )
}

export function IndoorSpecimen() {
  const copy = messages.about.specimen
  const rainyDay = WEATHER_SPECIMEN.find((day) => day.rainy)?.day ?? ''

  return (
    <div>
      <div role="img" aria-label={copy.weatherAria} className="flex gap-2">
        {WEATHER_SPECIMEN.map((day) => (
          <div
            key={day.day}
            className={cn(
              'flex-1 rounded-md border p-2 text-center',
              day.rainy ? 'border-weather-rain bg-bg' : 'bg-band border-transparent',
            )}
          >
            <p className="text-caption text-fg-muted font-semibold">{day.day}</p>
            <p className="text-title-2 leading-7">{day.icon}</p>
            <p className="text-caption text-fg font-semibold">{day.temp}</p>
            <p
              className={cn(
                'text-caption font-medium tabular-nums',
                day.rainy ? 'text-weather-rain' : 'text-fg-muted',
              )}
            >
              {copy.weatherRain.replace('{value}', String(day.rain))}
            </p>
          </div>
        ))}
      </div>
      <p className="text-body-2 text-fg mt-4 font-semibold">
        {copy.indoorTitle.replace('{day}', rainyDay)}
      </p>
      <ul className="mt-1">
        {INDOOR_SPECIMEN.map((place, index) => (
          <li
            key={place.title}
            className={cn('flex items-center gap-3 py-2', index > 0 && 'border-border border-t')}
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-2 text-fg font-semibold">{place.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Tag tone="neutral">{place.allowance}</Tag>
                <Tag tone="neutral">{place.size}</Tag>
              </div>
            </div>
            <span className="text-body-2 text-fg shrink-0 font-semibold tabular-nums">
              {place.distance}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-fg-muted mt-2 font-medium">{copy.indoorNote}</p>
    </div>
  )
}
