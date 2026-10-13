/**
 * 일정 상세 항목 메모의 표시 모델 — 이슈 #1448 · `일정상세-세부명세.md` D29.
 *
 * 메모는 AI 초안의 항목 설명(`note` → `memo`, 공통명세 S11-3)이거나 사용자가 적은 값이다.
 * 행은 **두 줄**까지만 보이고 넘치면 `더 보기` 로 편다.
 *
 * **높이를 재지 않고 글자 수 · 줄바꿈으로 가른다.** 실제 높이는 렌더 뒤에만 알 수 있어
 * 그때 버튼이 나타나면 행이 뒤늦게 밀리고, 서버 렌더와 결론이 달라진다 — 장소 소개
 * (`features/place/place-overview.tsx`)와 같은 판단이다. 한 줄 글자 수는 390 폭 행 본문
 * (썸네일 · 방문 토글을 뺀 폭)과 데스크톱 일자 열 폭에서 `text-body-2` 한글 기준으로 잡은
 * 어림이라, 경계 근처에서는 한 줄 차이로 버튼이 서거나 빠질 수 있다.
 */
export type PlanItemMemoCollapse = 'none' | 'mobile' | 'all'

export type PlanItemMemoView = {
  text: string
  /** `mobile` 은 `md` 미만에서만 접는다. 그 위 폭이면 두 줄에 들어온다 */
  collapse: PlanItemMemoCollapse
}

/** 행 본문이 보여 주는 줄 수 */
export const PLAN_ITEM_MEMO_LINES = 2

const MOBILE_CHARS_PER_LINE = 16
const DESKTOP_CHARS_PER_LINE = 32

function estimatedLines(text: string, charsPerLine: number): number {
  return text
    .split('\n')
    .reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / charsPerLine)), 0)
}

/** 메모가 없거나 공백뿐이면 `null` — 줄 자체를 세우지 않는다 */
export function planItemMemoView(memo: string | null): PlanItemMemoView | null {
  const text = (memo ?? '').trim()
  if (text === '') return null

  if (estimatedLines(text, DESKTOP_CHARS_PER_LINE) > PLAN_ITEM_MEMO_LINES) {
    return { text, collapse: 'all' }
  }
  if (estimatedLines(text, MOBILE_CHARS_PER_LINE) > PLAN_ITEM_MEMO_LINES) {
    return { text, collapse: 'mobile' }
  }
  return { text, collapse: 'none' }
}
