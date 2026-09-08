import type { HourlyWalkSafetyItem } from '@/types/insight'

/**
 * 이 시각이 추천 구간에 드는가 — #312.
 *
 * 곡선 위에서 `17:00 – 23:00` 이라고 추천해 놓고 **아래 셀 중 어느 것이 그 구간인지
 * 표시가 없었다.** 시각을 하나씩 대조해야 문장과 곡선이 이어졌다.
 *
 * **문자열로 견준다.** 서버가 `2026-08-29T18:00:00` 같은 지역 시각 문자열을 주는데
 * `Date` 로 파싱하면 브라우저 타임존으로 밀린다 (`hourMinute` 과 같은 이유다). 세 값이
 * 같은 응답에서 같은 형식으로 오므로 사전순 비교가 곧 시각순 비교다.
 *
 * **양끝을 포함한다.** `17:00 – 23:00` 은 17시 셀과 23시 셀을 함께 가리킨다 — 문장이
 * 그 두 시각을 적어 놓고 셀에서 빼면 문장과 그림이 다시 어긋난다.
 *
 * **`goldenStart == goldenEnd` 인 한 시각짜리 날이 정상이다** (#200). 그 한 칸만 든다.
 *
 * 구간이 없는 날(`null`)과 끝이 시작보다 앞선 날은 **아무 칸도 들지 않는다** — 뒤집힌
 * 구간을 화면이 해석해서 없는 추천을 만들지 않는다.
 */
export function isWithinGoldenWindow(
  at: string,
  goldenStart: string | null,
  goldenEnd: string | null,
): boolean {
  if (goldenStart === null || goldenEnd === null) return false
  if (goldenEnd < goldenStart) return false

  return at >= goldenStart && at <= goldenEnd
}

/**
 * 셀마다 추천 구간 여부와 **구간의 양끝인지**를 함께 낸다.
 *
 * 양끝을 아는 이유는 tint 면이 어디서 시작하고 끝나는지 눈에 보여야 하기 때문이다 —
 * 가운데 칸과 끝 칸을 구분하지 못하면 면이 곡선 전체로 흐른 것처럼 읽힌다.
 *
 * **`hourly` 의 순서를 그대로 쓴다.** 서버가 시각순으로 주고, 재정렬하지 않는다.
 */
export function markGoldenWindow(
  hourly: readonly HourlyWalkSafetyItem[],
  goldenStart: string | null,
  goldenEnd: string | null,
): { inWindow: boolean; windowStart: boolean; windowEnd: boolean }[] {
  const flags = hourly.map((hour) => isWithinGoldenWindow(hour.at, goldenStart, goldenEnd))

  return flags.map((inWindow, index) => ({
    inWindow,
    windowStart: inWindow && flags[index - 1] !== true,
    windowEnd: inWindow && flags[index + 1] !== true,
  }))
}
