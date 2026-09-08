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
