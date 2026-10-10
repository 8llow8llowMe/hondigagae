/**
 * 드래그 중 가장자리 자동 스크롤 (#161).
 *
 * **뷰포트 기준이다.** 일자 편집 목록은 자체 스크롤 컨테이너가 아니라 페이지와 함께
 * 흐르므로, 끌던 손가락이 화면 위·아래 끝에 닿으면 페이지를 움직여야 한다.
 *
 * 순수 함수로 뺀 이유는 **이 판정만 따로 검증하기 위해서다.** 나머지(rAF 루프·포인터
 * 캡처)는 DOM 이 필요해 이 저장소의 node 환경 테스트로 덮을 수 없다.
 */

/**
 * 가장자리로 인정하는 폭. 손가락이 화면 끝에 정확히 닿기 전에 스크롤이 시작돼야 한다 —
 * 끝까지 밀어야 반응하면 목록 밖으로 손이 나가 버린다.
 */
export const EDGE_PX = 60

/** 한 프레임 최대 이동. 60fps 기준 초당 약 840px 로, 화면 한 장을 1초 남짓에 지난다 */
const MAX_STEP_PX = 14

/**
 * 이번 프레임에 스크롤할 거리. **가장자리에서 멀면 `0`** 이고, 그때 호출부는 아무것도
 * 하지 않는다 — 짧은 목록에서 드래그해도 화면이 움직이지 않는 근거다.
 *
 * 가장자리 안에서는 **깊이에 비례**한다. 일정 속도로 밀면 조금만 걸쳤을 때 너무 빠르고,
 * 끝까지 밀었을 때 너무 느리다.
 *
 * @param pointerY 포인터의 `clientY` — 뷰포트 좌표다. 화면 밖이면 음수이거나 높이를 넘는다
 * @param viewportHeight `window.innerHeight`
 * @returns 위로 갈 거리는 음수, 아래는 양수, 필요 없으면 0
 */
export function autoScrollStep(pointerY: number, viewportHeight: number): number {
  /*
    **위아래 구역이 겹칠 만큼 짧은 뷰포트에서는 스크롤하지 않는다.** 겹치면 화면 한가운데
    에서도 한쪽 판정에 걸려, 가만히 있어도 목록이 흐른다.
  */
  if (viewportHeight <= EDGE_PX * 2) return 0

  if (pointerY < EDGE_PX) {
    return -step(EDGE_PX - pointerY)
  }

  const fromBottom = viewportHeight - pointerY
  if (fromBottom < EDGE_PX) {
    return step(EDGE_PX - fromBottom)
  }

  return 0
}

/**
 * 가장자리 안으로 들어온 깊이 → 이동 거리.
 *
 * **깊이를 1로 자른다.** 포인터가 화면 밖으로 나가면 깊이가 1을 넘는데, 그대로 곱하면
 * 손을 조금 더 뺐다고 스크롤이 몇 배로 빨라진다.
 */
function step(depth: number): number {
  const ratio = Math.min(depth / EDGE_PX, 1)
  return Math.max(1, Math.round(ratio * MAX_STEP_PX))
}
