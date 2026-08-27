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
