import type { MetricTone } from '@/components/metric'
import { formatStandaloneCelsius } from '@/lib/format/celsius'
import { congestionTone, walkSafetyTone, weatherWarningTone } from '@/lib/insight/tone'
import { resolveWeatherGlyph, type WeatherGlyphResolution } from '@/lib/insight/weather-icon'
import { messages } from '@/lib/messages'
import type { PlaceSuitabilityResponse, WalkSafetyResponse } from '@/types/insight'

/**
 * 비 확률이 이 값 이상이면 날씨 사실을 주의 쪽으로 보낸다 (#1233 D2 ⑤ "날씨는 강수확률 · 특보로").
 * 기상청이 "비 올 가능성 높음" 으로 읽는 60% 다 — 그 아래는 사실로만 둔다.
 */
const RAIN_CAUTION_PERCENT = 60

export type PreviewVerdictFact = {
  key: 'weather' | 'warning' | 'walk' | 'congestion'
  text: string
  /**
   * 주의 쪽이면 그 톤(`mid` 주의 · `critical` 위험), 좋은 쪽이면 `null`. 색은 `METRIC_WORD_TONE` 이
   * 정한다 — 이 파일은 톤만 고른다(등급 톤 매핑은 `metric.tsx` · `tone.ts` 소유).
   */
  tone: Extract<MetricTone, 'mid' | 'critical'> | null
  /** 날씨 줄의 하늘 그림. 그 밖의 줄은 `null` */
  glyph: WeatherGlyphResolution | null
}

/**
 * 오늘 판정 카드의 근거 사실 — **좋은 쪽 먼저, 주의 쪽은 아래** (#1233 D2 ⑤).
 *
 * 지난 판은 영향이 큰 근거 **첫 줄**을 부호와 상관없이 결론 밑에 붙여 `여행 적합` 아래 `붐빌 것으로
 * 예상` 이 섰다 — 결론과 근거가 반대로 읽혔다. 이제 사실마다 톤을 정하고 주의 쪽을 아래로 모아
 * "전체는 좋지만 이것은 조심" 으로 읽히게 한다.
 *
 * **근거 문장(`reasons[].description`)은 싣지 않는다** — 긴 서술이고 부호가 섞인다. 상세의 몫이다.
 * 판정 하나가 없으면(`null` — 실패 · 대기) 그 줄만 빠진다.
 */
export function previewVerdictFacts(
  suitability: PlaceSuitabilityResponse | null,
  walk: WalkSafetyResponse | null,
): PreviewVerdictFact[] {
  const facts: PreviewVerdictFact[] = []

  const warning = suitability?.weatherWarning ?? null
  if (warning !== null) {
    facts.push({
      key: 'warning',
      text: `${warning.type.name} ${warning.level.name}`,
      tone: weatherWarningTone(warning.level.code) === 'mid' ? 'mid' : 'critical',
      glyph: null,
    })
  }

  const weather = suitability?.weather ?? null
  if (weather !== null) {
    const maxTemp = formatStandaloneCelsius(weather.maxTemperature)
    const rain = weather.maxPrecipitationProbability
    const parts = [
      maxTemp === null ? null : messages.map.previewFactMaxTemp.replace('{temp}', maxTemp),
      rain === null ? null : messages.map.previewFactRain.replace('{percent}', String(rain)),
    ].filter((part): part is string => part !== null)
    const glyph = resolveWeatherGlyph(weather.skyState, weather.precipitationType)

    if (parts.length > 0 || glyph !== null) {
      facts.push({
        key: 'weather',
        text: parts.join(' · '),
        tone: rain !== null && rain >= RAIN_CAUTION_PERCENT ? 'mid' : null,
        glyph,
      })
    }
  }

  if (walk !== null) {
    const feelsLike = formatStandaloneCelsius(walk.feelsLikeCelsius)
    const grade = walk.walkSafetyLevel.name
    // 상세 판정 요약과 같은 값 표기다 (`place-verdict-summary-lines.ts`)
    const value =
      feelsLike === null
        ? grade
        : messages.place.detailSummaryWalkValue
            .replace('{grade}', grade)
            .replace('{feelsLike}', feelsLike)
    const safer =
      walk.saferWindowStart === null || walk.saferWindowEnd === null
        ? null
        : messages.map.previewFactSaferWindow
            .replace('{start}', walk.saferWindowStart.slice(0, 5))
            .replace('{end}', walk.saferWindowEnd.slice(0, 5))
    const tone = walkSafetyTone(walk.walkSafetyLevel.code)

    facts.push({
      key: 'walk',
      text: [messages.map.previewFactWalk.replace('{value}', value), safer]
        .filter((part): part is string => part !== null)
        .join(' · '),
      tone: tone === 'critical' ? 'critical' : tone === 'mid' ? 'mid' : null,
      glyph: null,
    })
  }

  const congestion = suitability?.congestion ?? null
  // `UNKNOWN` 은 "한산" 이 아니라 "데이터 없음" 이다 — 줄을 세우지 않는다
  if (congestion !== null && congestion.level.code !== 'UNKNOWN') {
    const rate = congestion.concentrationRate
    facts.push({
      key: 'congestion',
      text:
        rate === null
          ? congestion.level.name
          : messages.map.previewFactCongestion
              .replace('{grade}', congestion.level.name)
              .replace('{rate}', String(Math.round(rate))),
      // 붐빔(`HIGH` → low 톤)만 주의다. 보통은 사실로 둔다 — 혼잡은 위험이 아니라 조건이다
      tone: congestionTone(congestion.level.code) === 'low' ? 'mid' : null,
      glyph: null,
    })
  }

  return [
    ...facts.filter((fact) => fact.tone === null),
    ...facts.filter((fact) => fact.tone !== null),
  ]
}
