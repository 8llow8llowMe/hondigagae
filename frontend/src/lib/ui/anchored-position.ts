/**
 * 트리거에 붙는 팝오버의 뷰포트 좌표.
 *
 * **순수 함수다.** DOM 을 읽지 않고 사각형만 받는다 — 그래야 node 환경에서 테스트된다
 * (`docs/testing-guide.md` §1). `getBoundingClientRect()` 를 부르는 것은 호출부의 몫이다.
 *
 * 좌표는 `position: fixed` 기준(뷰포트 원점)이다. 스크롤 오프셋을 더하지 않는다.
 */

/** `getBoundingClientRect()` 에서 필요한 만큼만 */
export type AnchorRect = { top: number; bottom: number; left: number; width: number }
export type PanelSize = { width: number; height: number }
export type ViewportSize = { width: number; height: number }

export type AnchoredPosition = {
  top: number
  left: number
  /** 패널이 트리거보다 좁아 보이지 않게 하는 하한 */
  minWidth: number
  placement: 'below' | 'above'
}

/** 트리거와 패널 사이 */
const GAP = 8
/** 뷰포트 가장자리에 남길 여백 */
const GUTTER = 8

export function anchoredPosition(
  anchor: AnchorRect,
  panel: PanelSize,
  viewport: ViewportSize,
): AnchoredPosition {
  const roomBelow = viewport.height - anchor.bottom - GAP
  const roomAbove = anchor.top - GAP

  /*
    **기본은 아래다.** 위로 뒤집는 것은 아래가 실제로 안 들어가고 위가 더 넓을 때뿐이다 —
    "아래가 조금 모자라니 위로" 로 두면 스크롤에 따라 패널이 위아래로 튄다.
  */
  const placement: 'below' | 'above' =
    roomBelow >= panel.height || roomBelow >= roomAbove ? 'below' : 'above'

  const top = placement === 'below' ? anchor.bottom + GAP : anchor.top - GAP - panel.height

  /*
    좌우 clamp. **하한을 상한보다 먼저 적용하지 않는다** — 패널이 뷰포트보다 넓으면
    `viewport.width - panel.width - GUTTER` 가 `GUTTER` 보다 작아져, 순서를 뒤집으면
    left 가 음수가 되어 왼쪽이 잘린다.
  */
  const maxLeft = viewport.width - panel.width - GUTTER
  const left = Math.max(GUTTER, Math.min(anchor.left, maxLeft))

  return { top, left, minWidth: anchor.width, placement }
}
