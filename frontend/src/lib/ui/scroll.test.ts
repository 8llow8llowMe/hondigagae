import { describe, expect, it } from 'vitest'

import { centerScrollLeft, scrollFadeSide } from '@/lib/ui/scroll'

describe('centerScrollLeft', () => {
  it('선택 항목을 컨테이너 가운데로 가져온다', () => {
    // 브라우저 실측값: 375 폭 컨테이너에서 `음식점` 칩이 offsetLeft 646
    const result = centerScrollLeft({
      containerWidth: 375,
      scrollWidth: 732,
      itemOffsetLeft: 646,
      itemWidth: 66,
    })

    expect(result).toBe(357)
  })

  it('첫 항목이면 0 을 유지한다 (음수로 넘어가지 않는다)', () => {
    expect(
      centerScrollLeft({ containerWidth: 375, scrollWidth: 732, itemOffsetLeft: 0, itemWidth: 60 }),
    ).toBe(0)
  })

  it('스크롤 최대값을 넘지 않는다', () => {
    expect(
      centerScrollLeft({
        containerWidth: 375,
        scrollWidth: 400,
        itemOffsetLeft: 340,
        itemWidth: 60,
      }),
    ).toBe(25)
  })

  it('스크롤이 필요 없는 폭이면 0 이다', () => {
    expect(
      centerScrollLeft({
        containerWidth: 800,
        scrollWidth: 500,
        itemOffsetLeft: 300,
        itemWidth: 60,
      }),
    ).toBe(0)
  })
})

describe('scrollFadeSide', () => {
  it('처음에는 오른쪽에만 fade 를 준다', () => {
    expect(scrollFadeSide({ scrollLeft: 0, containerWidth: 375, scrollWidth: 732 })).toBe('right')
  })

  it('중간에서는 양쪽에 준다', () => {
    expect(scrollFadeSide({ scrollLeft: 150, containerWidth: 375, scrollWidth: 732 })).toBe('both')
  })

  it('끝까지 스크롤하면 왼쪽에만 준다 (마지막 항목이 흐려지지 않는다)', () => {
    expect(scrollFadeSide({ scrollLeft: 357, containerWidth: 375, scrollWidth: 732 })).toBe('left')
  })

  it('스크롤이 필요 없으면 fade 를 주지 않는다', () => {
    expect(scrollFadeSide({ scrollLeft: 0, containerWidth: 800, scrollWidth: 500 })).toBe('none')
  })

  it('1px 반올림 오차를 흡수한다', () => {
    expect(scrollFadeSide({ scrollLeft: 356, containerWidth: 375, scrollWidth: 732 })).toBe('left')
  })
})
