import { messages } from '@/lib/messages'

/**
 * 「더 자세히 정할게요」 접기 섹션의 요약과 펼침 판정.
 *
 * **순수 함수다.** `sigunguCode` 가 아니라 이미 풀린 `regionLabel` 을 받는다 —
 * 코드→라벨 표는 `features/place/filter-labels` 가 갖고 있고, `lib/` 이 `features/` 를
 * 가져오면 계층이 역참조된다.
 */
export type DetailsInput = {
  /** 표시용 지역 이름. 좁히지 않았으면 `제주 전체` */
  regionLabel: string
  /** 지역을 실제로 좁혔는가. 라벨만으로는 기본값과 구분할 수 없다 */
  regionNarrowed: boolean
  /** 만원 단위 문자열. 빈 값이 "상관없음" 이다 */
  budgetManwon: string
  preferFavorites: boolean
  pinnedCount: number
}

/** 접힌 줄에 붙는 한 줄 — `제주 전체 · 예산 상관없음 · 꼭 넣을 곳 2` */
export function detailsSummary({
  regionLabel,
  budgetManwon,
  preferFavorites,
  pinnedCount,
}: DetailsInput): string {
  /*
    **지역과 예산은 항상 쓴다.** 접힌 줄이 "무엇이 비어 있는지" 가 아니라 "무엇으로
    만들어지는지" 를 말해야 한다 — 기본값도 값이다.
  */
  const parts = [
    regionLabel,
    budgetManwon === ''
      ? messages.aiPlan.detailsBudgetAny
      : `${budgetManwon}${messages.aiPlan.fieldBudgetUnit}`,
  ]

  // 옵션은 **켠 것만** 붙인다. 끈 것까지 쓰면 줄이 길어지고 기본 상태가 시끄러워진다
  if (preferFavorites) parts.push(messages.aiPlan.detailsPreferFavorites)
  if (pinnedCount > 0) {
    parts.push(messages.aiPlan.detailsPinned.replace('{count}', String(pinnedCount)))
  }

  return parts.join(' · ')
}

/**
 * 펼친 채로 열 것인가.
 *
 * **호출부는 이것을 마운트 시 1회만 읽는다** (`ai-plan-create-form.tsx` 주석).
 * 반응형으로 두면 마지막 값을 지우는 순간 입력 중인 섹션이 접힌다.
 */
export function hasAnyDetail({
  regionNarrowed,
  budgetManwon,
  preferFavorites,
  pinnedCount,
}: DetailsInput): boolean {
  return regionNarrowed || budgetManwon !== '' || preferFavorites || pinnedCount > 0
}
