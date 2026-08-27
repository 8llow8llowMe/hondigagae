/**
 * 외부 원천(TourAPI)의 HTML 원문을 평문으로 정규화한다.
 *
 * `overview` / `homepage` 는 배치가 원문을 그대로 저장한 값이라 태그가 섞여 있다.
 * **`dangerouslySetInnerHTML` 을 쓰지 않는다** — 공공 API라도 신뢰 경계 밖의 문자열이다
 * (docs/features/place/장소상세-세부명세.md D5-3).
 */
const LINE_BREAK = /<br\s*\/?>/gi
const TAG = /<[^>]*>/g

/** 태그를 지운 **뒤에** 되돌린다. 먼저 되돌리면 &lt;script&gt; 가 태그로 재해석된다 */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

const ENTITY = /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g

/** 빈 결과는 `null` 이다 — 호출부가 섹션을 통째로 숨길 수 있어야 한다 */
export function toPlainText(raw: string | null): string | null {
  if (raw === null) return null

  const text = raw
    .replace(/\r\n/g, '\n')
    .replace(LINE_BREAK, '\n')
    .replace(TAG, '')
    .replace(ENTITY, (matched) => ENTITIES[matched] ?? matched)
    .trim()

  return text.length === 0 ? null : text
}
