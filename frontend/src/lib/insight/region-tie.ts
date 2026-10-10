import type { CodeNameMetadata } from '@/types/api'
import type { RegionWeatherItem } from '@/types/insight'

/** 최고점 동점 판정 결과 */
export type TiedTopRegions = {
  /**
   * 최고 `weatherScore` 를 가진 권역들. 서버 순서를 지키되 추천 권역만 첫 자리로 앞세운다.
   * 점수가 있는 권역이 없으면 빈 배열이다.
   */
  regions: RegionWeatherItem[]
  /** 동점이 **점수 있는 권역 전부**인가 — 예보를 못 받은 권역은 셈에 들어가지 않는다 */
  isAll: boolean
}

/**
 * 최고점 동점 권역 — 홈 권역 비교의 헤드라인이 1위를 단정해도 되는지 가리는 판정 (#638).
 *
 * **화면이 같은 숫자를 다섯 개 보여 주면서 한 곳을 고르면 안 된다.** 2026-09-15 실측에서
 * 다섯 권역 배지가 전부 `100` 인데 바로 위 문장은 "오늘은 제주시권이 가장 나아요" 였다.
 * 사용자는 표에서 그 근거를 찾지 못하고 자기가 잘못 읽었다고 생각한다.
 *
 * **판정 기준은 점수 값의 동일성뿐이다.** 서버가 `recommendedRegion` 으로 무엇을 골랐는지는
 * 문장의 **주어 순서**만 바꾼다 — 서버는 점수 밖의 축(특보 · 예보 신뢰도)을 볼 수 있으므로
 * 그 선택을 지우지 않고 앞세운다. 반대로 그 권역이 최고점이 아니면 목록에 끼워 넣지 않는다.
 * 끼워 넣으면 문장이 바로 아래 표와 다른 말을 한다.
 *
 * **`null` 은 0점이 아니다.** 예보를 못 받아 판정하지 않은 권역이라(`weatherScore` 주석)
 * 동점 셈에서 빼야 "어느 권역이든 좋아요" 가 예보 없는 권역까지 포함하는 거짓말이 되지 않는다.
 * `sortRegionsByScore` 가 같은 값을 맨 뒤로 보내는 것과 같은 규칙이다.
 *
 * **입력을 변형하지 않는다.** `regions` 는 쿼리 캐시가 들고 있는 배열이다.
 */
export function findTiedTop(
  regions: RegionWeatherItem[],
  recommendedRegion: CodeNameMetadata | null,
): TiedTopRegions {
  const scored = regions.filter(
    (item): item is RegionWeatherItem & { weatherScore: number } => item.weatherScore !== null,
  )

  if (scored.length === 0) return { regions: [], isAll: false }

  const top = Math.max(...scored.map((item) => item.weatherScore))
  const tied = scored.filter((item) => item.weatherScore === top)

  const recommended = tied.find((item) => item.region.code === recommendedRegion?.code)
  const ordered =
    recommended === undefined ? tied : [recommended, ...tied.filter((it) => it !== recommended)]

  return { regions: ordered, isAll: tied.length === scored.length }
}
