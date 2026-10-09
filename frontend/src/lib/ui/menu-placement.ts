/**
 * 트리거에 붙는 팝오버를 위로 여나 아래로 여나 — 장소-반려견칩-세부명세 D1-2.
 *
 * **순수 함수다.** DOM 을 읽지 않고 숫자만 받는다 — `getBoundingClientRect()` · 탭바 윗변을 재는 것은
 * 호출부의 몫이다 (`docs/testing-guide.md` §1). 자리(`top`/`left`)까지 정하는 `anchoredPosition` 과 달리
 * 이쪽은 **흐름 안 `absolute` 패널**의 방향만 정한다 — 패널은 트리거 옆에 그대로 붙는다.
 *
 * **기본은 아래다.** 위로 뒤집는 것은 아래가 실제로 모자라고 위가 더 넓을 때뿐이다 — 여유가 같으면
 * 아래로 기운다(`anchoredPosition` 과 같은 판단).
 */

/** 트리거 · 화면 바닥과 패널 사이에 남길 여백 */
const GAP = 8

export type MenuPlacement = 'below' | 'above'

export function menuPlacement({
  triggerTop,
  triggerBottom,
  panelHeight,
  viewportBottom,
}: {
  /** 트리거 윗변 (뷰포트 기준) */
  triggerTop: number
  /** 트리거 아랫변 (뷰포트 기준) */
  triggerBottom: number
  panelHeight: number
  /** 패널이 내려갈 수 있는 바닥 — 탭바가 서 있으면 그 윗변, 아니면 `innerHeight` */
  viewportBottom: number
}): MenuPlacement {
  const roomBelow = viewportBottom - triggerBottom - GAP
  const roomAbove = triggerTop - GAP

  return roomBelow >= panelHeight || roomBelow >= roomAbove ? 'below' : 'above'
}
