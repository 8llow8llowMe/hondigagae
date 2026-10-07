import { toPlainText } from '@/lib/place/text'

/**
 * 운영시간 원문의 **첫 줄**을 방문 핵심 줄용으로 뽑는다 (#1226).
 *
 * 핵심 줄은 한 줄짜리 요약이다. `09:00~18:00` 아래 `(입장 마감 17:00)` 같은 보충은
 * 방문 정보 카드의 `운영시간` 행이 전문으로 말한다 — 여기서 다 옮기면 제목 아래가
 * 방문 정보 카드의 사본이 된다.
 *
 * **판정(`openNow`)이 대부분 비어 있어 원문이 필요하다.** dev 50곳 표본(2026-10-07)에서
 * `openNow` 가 있는 곳은 5곳, `useTime` 원문이 있는 곳은 25곳이었다 (수월봉 `상시 개방`).
 */
export function hoursHeadline(useTime: string | null): string | null {
  const text = toPlainText(useTime)
  if (text === null) return null

  const first = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  return first ?? null
}
