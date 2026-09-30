import { formatStandaloneCelsius } from '@/lib/format/celsius'
import { findTiedTop } from '@/lib/insight/region-tie'
import { messages } from '@/lib/messages'
import type { CodeNameMetadata } from '@/types/api'
import type { RegionWeatherItem } from '@/types/insight'

/**
 * 홈 권역 칸의 값 표기 — #1068 (`권역-점수-라벨-세부명세.md` D9).
 *
 * 칸(`regional-weather-section.tsx` `RegionRow`)은 이 파일이 만든 값만 그린다. 분기가 칸 안에
 * 있으면 node 환경 렌더 테스트로 갈래를 다 세우기 어렵고, 헤드라인과 칸 표시가 같은 규칙을
 * 따르는지 한곳에서 볼 수 없다.
 */

/**
 * 하루 기온 한 줄 — `24–31℃`.
 *
 * **표기는 #1067 의 "혼자 서는 값" 이다** (`formatStandaloneCelsius`). 이 줄은 열로 늘어선
 * 값이 아니라 칸마다 홀로 서므로 `.0` 이 자릿수를 맞춰 주지 않고 읽기만 방해한다.
 *
 * - 두 값이 같으면 한 값이다 — `31–31℃` 는 범위가 아니다 (dev 는 같은 날이 많다)
 * - 한쪽만 오면 **그 값의 이름을 붙인다** (`최고 31℃`). 접두 없이 `31℃` 만 두면 무슨 온도인지
 *   알 수 없다 (#206)
 * - 둘 다 없으면 `null` — 줄 자체를 내지 않는다
 *
 * **서버 순서를 고치지 않는다.** 최저가 최고보다 높게 와도 그대로 적는다 — 값을 바로잡는 것은
 * FE 의 일이 아니다.
 */
export function regionTemperatureText(min: number | null, max: number | null): string | null {
  const low = formatStandaloneCelsius(min)
  const high = formatStandaloneCelsius(max)

  if (low !== null && high !== null) {
    return low === high
      ? messages.home.regionTempSingle.replace('{value}', high)
      : messages.home.regionTempRange.replace('{min}', low).replace('{max}', high)
  }

  if (high !== null) {
    return `${messages.home.regionTempPrefix} ${messages.home.regionTempSingle.replace('{value}', high)}`
  }

  if (low !== null) {
    return `${messages.home.regionMinTempPrefix} ${messages.home.regionTempSingle.replace('{value}', low)}`
  }

  return null
}

/**
 * `추천` 표시를 붙일 권역 코드 — 없으면 `null`.
 *
 * **헤드라인(`Recommendation`)이 `가장 나아요` 라고 말하는 날과 정확히 같다.** 그 문장은 서버가
 * 추천을 냈고(`recommendedRegion !== null`) 최고점이 동점이 아닐 때만 선다 (#638). 칸 표시가 다른
 * 규칙을 따르면 문장과 표가 다른 곳을 가리킨다.
 *
 * - 경보 날(추천 없음) — 서버가 막아 둔 문을 칸 표시가 다시 열지 않는다
 * - 동점 날 — 헤드라인이 1위를 단정하지 않으므로 칸도 한 곳을 고르지 않는다
 * - **서버가 고른 권역을 따른다.** 점수가 가장 높은 칸을 FE 가 다시 고르지 않는다 — 서버는 점수
 *   밖의 축을 볼 수 있고, 헤드라인이 이미 서버의 선택을 말하고 있다
 */
export function soleRecommendedCode(
  regions: RegionWeatherItem[],
  recommendedRegion: CodeNameMetadata | null,
): string | null {
  if (recommendedRegion === null) return null

  return findTiedTop(regions, recommendedRegion).regions.length < 2 ? recommendedRegion.code : null
}

/**
 * 점수 막대의 길이(%) — 100점 만점이라 점수가 곧 길이다.
 *
 * 계약은 0~100 이지만 막대가 칸 밖으로 나가거나 음수 폭이 되지 않게 가둔다.
 */
export function scoreBarPercent(score: number): number {
  return Math.min(100, Math.max(0, score))
}
