/**
 * 순서 편집을 연 직후 **편집 영역 머리가 화면에 보이는가** 의 판정 (#1427).
 *
 * `순서 편집` 은 일자 카드의 **맨 아래** 액션 줄에 있다. 누르면 같은 자리의 항목 목록(사진이
 * 있어 행이 높다)이 편집기(사진 없이 낮다)로 바뀌고 액션 줄 · 실내 대안이 사라진다 — 카드가
 * 줄어드는데 스크롤 위치는 그대로라, 목록 아래쪽까지 내려와 버튼을 누른 사람에게는 편집기
 * 머리가 헤더 뒤(화면 위)로 올라가 버리고 화면에는 그 아래의 다음 일자가 선다. 사용자가 본
 * "화면이 아래로 튄다" 가 이것이다. 브라우저의 scroll anchoring 이 아래쪽 노드를 붙잡아 위치를
 * 보정하면 반대로 편집기가 화면 아래로 밀리기도 한다 — **원인이 어느 쪽이든 결과는 "머리가
 * 보이지 않음" 하나라** 그것만 판정한다.
 *
 * **보이면 건드리지 않는다.** 화면 가운데에서 편집을 연 사람의 시야를 매번 끌어올리면 그것이
 * 또 하나의 튐이다.
 *
 * 순수 함수로 뺀 이유는 경계값을 node 환경에서 재기 위해서다 — 좌표 읽기와 스크롤은 DOM 이
 * 필요해 호출부(`PlanDayEditor`)가 맡는다.
 */

/**
 * 머리 아래로 이만큼은 보여야 "보인다" 고 본다 — 편집 안내 한 줄 + 첫 행(이동 버튼 44 + 위아래
 * 여백 16) 이 들어가는 높이다. 머리만 화면 끝에 1px 걸쳐 있는 것은 보이는 것이 아니다.
 */
export const EDITOR_MIN_VISIBLE_PX = 120

export function editorTopNeedsReveal({
  top,
  viewportHeight,
  headerHeight,
}: {
  /** 편집 영역의 `getBoundingClientRect().top` */
  top: number
  /** `window.innerHeight` */
  viewportHeight: number
  /** 고정 헤더 높이(`--header-h`). 이 위는 헤더가 가린다 */
  headerHeight: number
}): boolean {
  if (top < headerHeight) return true
  return top > viewportHeight - EDITOR_MIN_VISIBLE_PX
}
