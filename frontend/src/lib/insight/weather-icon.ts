import type { CodeNameMetadata } from '@/types/api'

/** 그릴 수 있는 날씨 그림. 컴포넌트 매핑은 `WeatherGlyph` 가 갖는다 */
export type WeatherIconKind = 'sun' | 'partly-cloudy' | 'cloud' | 'rain' | 'snow' | 'sleet'

/**
 * 무엇을 그릴지 / 무엇이라 읽을지.
 *
 * `kind` 가 `null` 이면 **그림 대신 서버 `name` 을 낱말로 적는다** — 모르는 코드를 빈
 * 자리로 두지 않으면서, 없는 그림을 지어내지도 않는다.
 */
export type WeatherGlyphResolution = { kind: WeatherIconKind | null; name: string }

/**
 * 서버 코드 → 그림 (#314).
 *
 * **코드는 서버 enum 의 이름이다** (`CodeNameDescribable.toMetadata()` 가 `enumValue.name()`
 * 을 넣는다). 기상청 숫자 코드(`"1"`·`"3"`)가 아니다 — 실제로 확인하고 적었다.
 *
 * | 서버 enum | 코드 |
 * |-----------|------|
 * | `SkyState` | `CLEAR` · `MOSTLY_CLOUDY` · `OVERCAST` · `UNKNOWN` |
 * | `PrecipitationType` | `NONE` · `RAIN` · `RAIN_SNOW` · `SNOW` · `SHOWER` · `DRIZZLE` · `DRIZZLE_SNOW` · `SNOW_FLURRY` · `UNKNOWN` |
 *
 * **이것은 한국어 매핑 테이블이 아니다.** 낱말은 서버 `name` 을 그대로 쓰고(그림을 못 그릴
 * 때도, `sr-only` 에서도), 이 표가 정하는 것은 **어떤 그림을 그릴지**뿐이다.
 */
const SKY_ICONS: Record<string, WeatherIconKind> = {
  CLEAR: 'sun',
  MOSTLY_CLOUDY: 'partly-cloudy',
  OVERCAST: 'cloud',
}

const PRECIPITATION_ICONS: Record<string, WeatherIconKind> = {
  RAIN: 'rain',
  SHOWER: 'rain',
  DRIZZLE: 'rain',
  SNOW: 'snow',
  SNOW_FLURRY: 'snow',
  RAIN_SNOW: 'sleet',
  DRIZZLE_SNOW: 'sleet',
}

/**
 * 권역 행에 세울 날씨 그림을 고른다 — #314.
 *
 * **강수가 있으면 강수형태가 이긴다.** 비 오는 날 해를 그리지 않는다. 하늘상태와 강수형태는
 * 같은 시각에 둘 다 오는데(`맑음` + `없음`), 강수가 있는 날은 그것이 그 시각의 날씨다.
 *
 * 네 갈래로 끝난다.
 *
 * | 상태 | 결과 |
 * |------|------|
 * | 둘 다 `null` (예보를 못 받음) | `null` — 행의 `예보 없음` 배지가 이미 말한다 |
 * | 고른 값이 `UNKNOWN` | `null` — 서버가 "정보 없음" 이라 한 자리에 그림을 세우면 없는 사실을 만든다 |
 * | 아는 코드 | 그 그림 + 서버 `name`(`sr-only`) |
 * | **모르는 코드** | 그림 없이 **서버 `name` 을 낱말로** — 빈 자리로 두지 않고, 틀린 그림도 그리지 않는다 |
 *
 * 마지막 갈래가 이 함수의 핵심이다. 서버가 코드를 하나 더 내면 화면은 그 낱말을 그대로
 * 적는다 — FE 가 아는 코드만 나열해 두고 나머지를 지우는 구조가 되지 않는다.
 */
export function resolveWeatherGlyph(
  skyState: CodeNameMetadata | null,
  precipitationType: CodeNameMetadata | null,
): WeatherGlyphResolution | null {
  const raining =
    precipitationType !== null &&
    precipitationType.code !== 'NONE' &&
    precipitationType.code !== 'UNKNOWN'

  const subject = raining ? precipitationType : skyState

  if (subject === null) return null
  // 서버가 "정보 없음" 이라고 한 자리다. 그림도 낱말도 보탤 것이 없다
  if (subject.code === 'UNKNOWN') return null

  const table = raining ? PRECIPITATION_ICONS : SKY_ICONS

  return { kind: table[subject.code] ?? null, name: subject.name }
}
