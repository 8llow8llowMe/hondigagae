import { toPlainText } from '@/lib/place/text'

/**
 * 장소 소개로 **그릴 만한** 평문을 고른다 (#1226).
 *
 * 원천 개요가 분류 낱말 하나인 장소가 있다 — dev 50곳 표본(2026-10-07)에서 `관광지`(분류
 * `관광지` · 원천 분류 `여행지`)와 `박물관`(분류 `문화시설` · 원천 분류 `박물관`)이 나왔다.
 * 원인은 적재다(#1216). 그대로 그리면 바로 위 메타 줄의 분류명을 한 번 더 말하는 줄이 선다.
 *
 * **정확히 같을 때만 거른다.** 짧다는 이유로 거르지 않는다 — `오름` 처럼 분류와 다른 한
 * 낱말은 정보다. #1216 재적재 뒤에는 이 갈래가 비지만, 재적재 전 데이터와 다른 원천이
 * 같은 모양으로 들어오는 경우를 막으려고 FE 에도 둔다.
 *
 * `labels` 는 `contentType.name` 과 `sourceCategory` 다. `null` 은 비교하지 않는다.
 */
export function meaningfulOverview(
  raw: string | null,
  labels: readonly (string | null)[],
): string | null {
  const text = toPlainText(raw)
  if (text === null) return null

  return labels.some((label) => label !== null && label.trim() === text) ? null : text
}
