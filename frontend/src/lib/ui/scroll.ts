/**
 * 가로 스크롤 컨테이너에서 특정 항목을 가운데로 오게 하는 `scrollLeft` 값.
 *
 * `scrollIntoView({ inline: 'center' })` 를 쓰지 않는 이유:
 *  - 조상 스크롤 컨테이너(페이지)까지 함께 움직인다
 *  - 실제로 동작하지 않는 경우가 관측됐다 (하이드레이션 직후 `scrollLeft` 가 0 으로 남음)
 *
 * 직접 계산하면 컨테이너 하나만 움직이고 결과가 결정론적이라 테스트할 수 있다.
 */
export function centerScrollLeft(params: {
  /** 컨테이너의 보이는 폭 */
  containerWidth: number
  /** 컨테이너 전체 스크롤 폭 */
  scrollWidth: number
  /** 항목의 컨테이너 기준 좌측 offset */
  itemOffsetLeft: number
  /** 항목 폭 */
  itemWidth: number
}): number {
  const { containerWidth, scrollWidth, itemOffsetLeft, itemWidth } = params

  const centered = itemOffsetLeft - (containerWidth - itemWidth) / 2
  const max = Math.max(0, scrollWidth - containerWidth)

  return Math.round(Math.min(Math.max(0, centered), max))
}

/** 가로 스크롤 컨테이너에서 노출할 fade 방향 */
export type ScrollFade = 'none' | 'left' | 'right' | 'both'

/**
 * "더 있다"는 신호를 어느 쪽에 줄지 정한다.
 *
 * 끝까지 스크롤한 뒤에도 fade 가 남아 있으면 마지막 항목이 이유 없이 흐려진다.
 * 실제로 스크롤 여지가 있는 쪽에만 준다.
 */
export function scrollFadeSide(params: {
  scrollLeft: number
  containerWidth: number
  scrollWidth: number
}): ScrollFade {
  const { scrollLeft, containerWidth, scrollWidth } = params

  // 소수점 오차와 1px 반올림을 흡수한다
  const EPSILON = 2
  const canScrollLeft = scrollLeft > EPSILON
  const canScrollRight = scrollLeft + containerWidth < scrollWidth - EPSILON

  if (canScrollLeft && canScrollRight) return 'both'
  if (canScrollLeft) return 'left'
  if (canScrollRight) return 'right'
  return 'none'
}

/**
 * 좌우 화살표로 한 번에 옮길 `scrollLeft` 값.
 *
 * **한 화면씩 넘기되 한 겹을 남긴다.** 컨테이너 폭만큼 통째로 밀면 이동 전에 보던 항목이
 * 하나도 남지 않아, 사용자가 "방금 본 것 다음" 인지 "건너뛴" 것인지 확인할 수 없다.
 * 겹치는 폭(`overlap`)이 그 연결고리다.
 *
 * **`scrollBy` 를 그냥 부르지 않는 이유는 끝단이다.** 브라우저가 알아서 clamp 하긴 하지만,
 * 그러면 "얼마나 갈지" 를 화면이 알 수 없어 이 계산을 테스트할 수 없다. 방향 판정
 * (`scrollFadeSide`)과 같은 자리에 두고 같은 규칙으로 잰다.
 */
export function pageScrollLeft(params: {
  scrollLeft: number
  /** 컨테이너의 보이는 폭 */
  containerWidth: number
  /** 컨테이너 전체 스크롤 폭 */
  scrollWidth: number
  direction: 'left' | 'right'
  /** 이동 전후에 겹쳐 남길 폭. 기본 48 — 곡선 셀 하나(3rem) */
  overlap?: number
}): number {
  const { scrollLeft, containerWidth, scrollWidth, direction, overlap = 48 } = params

  // 컨테이너가 겹침 폭보다 좁으면 겹치기가 성립하지 않는다 — 그때는 폭만큼 민다
  const step = containerWidth > overlap ? containerWidth - overlap : containerWidth
  const max = Math.max(0, scrollWidth - containerWidth)
  const next = direction === 'left' ? scrollLeft - step : scrollLeft + step

  return Math.round(Math.min(Math.max(0, next), max))
}

/** 놓을 때 다음 칸으로 넘기는 끈 거리 — 칸 폭에 대한 비율 (#1233 D3) */
const SWIPE_DISTANCE_RATIO = 0.15
/** 놓을 때 다음 칸으로 넘기는 속도(px/ms) — 짧게 튕긴 것도 넘긴다 */
const SWIPE_VELOCITY = 0.3

/**
 * 마우스로 끌던 캐러셀을 놓았을 때 **갈 칸** (#1233 D3).
 *
 * 예전에는 놓을 때 스냅만 다시 켰다 — 브라우저가 가장 가까운 칸으로 애니메이션 없이 붙여서
 * 30% 를 끌어도 되돌아갔다. 방향과 속도를 보고 칸을 직접 고른다:
 *
 * - **한 칸 넘게 끌었으면** 지나친 칸을 세고, 남은 거리로 다시 가른다.
 * - **빠르게 튕겼으면(≥ 0.3px/ms)** 튕긴 방향이 이긴다. 끌던 쪽과 반대로 튕기면 끈 만큼을
 *   되돌린다 — 다음 칸으로 가다 마음을 바꾼 것이다.
 * - **느리면** 남은 거리가 칸 폭의 15% 이상일 때만 끈 방향 다음 칸이다.
 *
 * 부호는 **스크롤 방향**이다 — 양수가 다음 칸 쪽(포인터는 왼쪽으로 움직였다).
 */
export function swipeTarget(params: {
  /** 누른 뒤 스크롤이 움직인 거리(px). 양수 = 다음 칸 쪽 */
  dragPx: number
  /** 놓기 직전의 속도(px/ms). 부호는 `dragPx` 와 같다 */
  velocity: number
  /** 칸 하나의 폭 + 사이 간격 */
  step: number
  /** 누를 때 있던 칸 (0-based) */
  index: number
  count: number
}): number {
  const { dragPx, velocity, step, index, count } = params
  if (step <= 0 || count <= 0) return index

  const passed = Math.trunc(dragPx / step)
  const rest = dragPx - passed * step

  let move = passed
  if (Math.abs(velocity) >= SWIPE_VELOCITY) {
    const direction = Math.sign(velocity)
    // 남은 거리가 없거나 같은 쪽이면 한 칸 더, 반대쪽이면 남은 거리를 버린다
    if (rest === 0 || Math.sign(rest) === direction) move += direction
  } else if (Math.abs(rest) >= step * SWIPE_DISTANCE_RATIO) {
    move += Math.sign(rest)
  }

  return Math.min(count - 1, Math.max(0, index + move))
}
