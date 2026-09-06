/**
 * 판정 옆에 세울 큰 숫자 하나 — #253.
 *
 * **체감온도가 먼저다.** 반려견은 헐떡임으로 체온을 내려 **습도에 사람보다 민감하고**,
 * 기온과 상대습도를 합친 열지수가 이 서비스 판정의 핵심 지표다. 아트보드가 일정 상세와
 * 장소 상세에 둔 `33.4℃` 도 최고기온이 아니라 이 값이다.
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
