/** 어절 사이 지연 — 형제 60ms 간격 (DESIGN.md §8 · 명세 2026-09-25 §4) */
export const SPLIT_WORD_STAGGER_MS = 60

/**
 * 어절 단위로 올라오는 히어로 제목 (#915, 명세 2026-09-25 §4).
 *
 * **서버 컴포넌트이고 JS 가 없다.** 움직임은 `app/globals.css` 의 `.about-split-word`
 * (`@keyframes`)가 맡고, 이 컴포넌트는 어절마다 `animationDelay` 만 준다. 정적 마크업에
 * 숨김 클래스가 없다 — 시작 상태는 keyframes 의 `from` 이고, 감속 모션은 전역 규칙이 한
 * 프레임으로 줄여 끝 상태로 선다.
 *
 * **스크린리더에는 한 문장으로 읽힌다.** 원문은 `sr-only` 텍스트로, 조각은 `aria-hidden` 으로
 * 둔다 — 판정 카드 · 규모 숫자와 같은 계약이다. `aria-label` 로 두지 않은 이유: 브라우저 번역이
 * 보이는 조각만 옮기고 `aria-label` 은 원문으로 남긴다. 조각 사이 공백은 텍스트 노드로 남겨
 * `break-keep` 줄바꿈이 그대로 된다.
 */
export function SplitHeading({
  id,
  text,
  className,
}: {
  id: string
  text: string
  className?: string
}) {
  const words = text.split(' ')

  return (
    <h1 id={id} className={className}>
      <span className="sr-only">{text}</span>
      {words.map((word, index) => (
        <span key={`${index}-${word}`}>
          {index > 0 && ' '}
          <span
            aria-hidden
            className="about-split-word"
            style={{ animationDelay: `${index * SPLIT_WORD_STAGGER_MS}ms` }}
          >
            {word}
          </span>
        </span>
      ))}
    </h1>
  )
}
