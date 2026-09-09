/**
 * 판정 옆에 세울 큰 숫자 하나 — #253.
 *
 * **체감온도가 먼저다.** 반려견은 헐떡임으로 체온을 내려 **습도에 사람보다 민감하고**,
 * 기온과 상대습도를 합친 체감온도가 이 서비스 판정의 핵심 지표다. 아트보드가 일정 상세와
 * 장소 상세에 둔 `33.4℃` 도 최고기온이 아니라 이 값이다.
 *
 * **그 체감온도는 열지수가 아니다** (#292 · BE `46f35e4`). 예전에는 미국 NOAA 열지수
 * (Rothfusz)였고 이 주석도 그렇게 적혀 있었다. 지금 `maxFeelsLikeTemperature` 는 **기상청
 * 여름철 체감온도**의 하루 최대값이고(BE `DailyWeather`), 열지수는 판정에서 내려와 산책
 * 위험도 응답의 참고값(`heatIndexCelsius`)으로만 남았다 — **이 파일이 고르는 값과 무관하다.**
 * 필드명과 아래 로직은 그대로 맞다. 틀렸던 것은 그 값을 부르는 이름이다.
 *
 * **일정 브리핑과 장소 적합도가 함께 쓴다.** 두 응답의 날씨 DTO 는 다른 타입이지만
 * (`PlanDailyWeatherItem` · `DailyWeatherItem`) 고르는 규칙은 같아야 한다 — 같은 값을
 * 두 화면이 다르게 부르면 그것이 곧 신뢰를 깎는다. 그래서 **구조만 받는다.**
 *
 * **둘을 나란히 세우지 않는다.** 같은 ℃ 라 숫자 두 개가 붙으면 어느 쪽이 무엇인지
 * 라벨을 읽어야 알 수 있고, 그 순간 "큰 숫자 하나" 라는 이 자리의 성격이 사라진다.
 *
 * **없을 때 최고기온으로 갈음하되, 이름을 바꿔 말하지 않는다.** 중기예보 구간은 시각별
 * 데이터가 없어 체감온도가 **언제나 null** 이다(서버도 최고기온을 대신 채우지 않는다).
 * 그 자리를 비우면 11일 예보 중 뒤쪽 날들이 통째로 숫자를 잃으므로 최고기온을 세우되,
 * `kind` 를 갈라 **화면이 `최고기온` 이라고 말하게 한다** — 최고기온을 체감온도라고
 * 부르면 판정의 근거를 잘못 알려 주는 것이다.
 */
export type DisplayTemperature = {
  kind: 'feelsLike' | 'max'
  value: number
}

/** 날씨 DTO 두 종류가 공통으로 갖는 온도 필드만 본다 */
type TemperatureSource = {
  maxFeelsLikeTemperature?: number | null
  maxTemperature?: number | null
  /** 큰 숫자에는 쓰이지 않고 `supportingTemperatures` 만 본다 (#352) */
  minTemperature?: number | null
}

export function displayTemperature(
  weather: TemperatureSource | null | undefined,
): DisplayTemperature | null {
  const feelsLike = weather?.maxFeelsLikeTemperature
  if (typeof feelsLike === 'number') return { kind: 'feelsLike', value: feelsLike }

  const max = weather?.maxTemperature
  if (typeof max === 'number') return { kind: 'max', value: max }

  return null
}

/** 큰 숫자를 받치는 보조 온도 한 값 */
export type SupportingTemperature = {
  kind: 'max' | 'min'
  value: number
}

/**
 * 큰 숫자(`displayTemperature`) 아래에 받치는 **최고·최저기온** — #352.
 *
 * **하루의 폭이 판단을 가른다.** 게스트 블록이 `최고 체감온도 33.4℃` 한 값만 보여 주고
 * 있었는데, 응답에 이미 `maxTemperature` · `minTemperature` 가 실려 있었다. 33.4℃ 만으로는
 * 아침에 나갈 수 있는 날인지 알 수 없다.
 *
 * **큰 숫자를 되풀이하지 않는다.** 체감온도를 못 받은 날(중기예보 구간)에는
 * `displayTemperature` 가 최고기온을 큰 숫자로 세우므로(`kind: 'max'`), 그때 여기서
 * 최고기온을 다시 말하면 같은 값이 한 자리에 두 번 선다. 그 경우 최저만 남긴다.
 *
 * **`displayTemperature` 와 짝이라 함께 읽어야 한다** — 저쪽이 무엇을 집었는지가 이쪽이
 * 무엇을 빼는지를 정한다. 그래서 큰 숫자를 인자로 받는다(다시 계산하지 않는다).
 * 계산이 갈리면 같은 값이 두 번 서거나 최고기온이 통째로 사라진다.
 *
 * **둘 다 없으면 빈 배열이다** — 호출부가 줄 자체를 내지 않는다. `0` 은 유효한 온도라
 * falsy 검사로 걸러서는 안 되고, 여기서 `typeof` 로 가른다.
 */
export function supportingTemperatures(
  weather: TemperatureSource | null | undefined,
  displayed: DisplayTemperature | null,
): SupportingTemperature[] {
  const out: SupportingTemperature[] = []

  const max = weather?.maxTemperature
  if (typeof max === 'number' && displayed?.kind !== 'max') out.push({ kind: 'max', value: max })

  const min = weather?.minTemperature
  if (typeof min === 'number') out.push({ kind: 'min', value: min })

  return out
}
