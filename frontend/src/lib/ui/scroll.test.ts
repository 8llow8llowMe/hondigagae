import { describe, expect, it } from 'vitest'

import { centerScrollLeft, pageScrollLeft, scrollFadeSide, swipeTarget } from '@/lib/ui/scroll'

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

describe('pageScrollLeft', () => {
  /*
    홈 골든타임 곡선 실측 (1280 데스크톱, 좌측 레일 400): 스크롤러가 레일 폭을 꽉 채워
    `clientWidth` 400, 13시간 × (48 + gap 6) 로 `scrollWidth` 744 → 여지는 344 뿐이다.
  */
  const RAIL = { containerWidth: 400, scrollWidth: 744 }

  it('한 번에 컨테이너 폭에서 한 셀만 남기고 민다', () => {
    // 여지가 넉넉한 경우라야 걸음 폭 자체가 보인다 — 400 - 48
    expect(
      pageScrollLeft({ containerWidth: 400, scrollWidth: 2000, scrollLeft: 0, direction: 'right' }),
    ).toBe(352)
  })

  it('되돌아올 때도 같은 폭이다', () => {
    expect(
      pageScrollLeft({
        containerWidth: 400,
        scrollWidth: 2000,
        scrollLeft: 352,
        direction: 'left',
      }),
    ).toBe(0)
  })

  it('오른쪽 끝을 넘지 않는다', () => {
    // 걸음(352)이 남은 여지(344)보다 커도 끝에서 멈춘다
    expect(pageScrollLeft({ ...RAIL, scrollLeft: 0, direction: 'right' })).toBe(344)
  })

  it('왼쪽 끝에서 음수로 넘어가지 않는다', () => {
    expect(pageScrollLeft({ ...RAIL, scrollLeft: 40, direction: 'left' })).toBe(0)
  })

  it('스크롤이 필요 없는 폭이면 0 이다', () => {
    expect(
      pageScrollLeft({ containerWidth: 800, scrollWidth: 500, scrollLeft: 0, direction: 'right' }),
    ).toBe(0)
  })

  /*
    겹침 폭보다 좁은 컨테이너 — 폭만큼 민다. 겹치기를 고집하면 `step` 이 0 이나 음수가 되어
    화살표를 눌러도 아무 일이 없거나 반대로 간다.
  */
  it('컨테이너가 겹침 폭보다 좁으면 폭만큼 민다', () => {
    expect(
      pageScrollLeft({ containerWidth: 40, scrollWidth: 300, scrollLeft: 0, direction: 'right' }),
    ).toBe(40)
  })
})

describe('swipeTarget — 놓을 때 갈 칸 (#1233 D3)', () => {
  // 미리보기 캐러셀 실측 폭: 사진 342 + gap 8
  const step = 350

  function target(dragPx: number, velocity: number, index = 2, count = 6) {
    return swipeTarget({ dragPx, velocity, step, index, count })
  }

  it('칸 폭의 15% 를 넘게 끌면 끈 방향 다음 칸이다 — 느리게 끌어도', () => {
    expect(target(step * 0.15, 0)).toBe(3)
    expect(target(-step * 0.15, 0)).toBe(1)
  })

  it('15% 에 못 미치고 느리면 제자리로 돌아간다', () => {
    expect(target(step * 0.14, 0.1)).toBe(2)
    expect(target(-step * 0.14, -0.1)).toBe(2)
  })

  it('짧게 끌어도 0.3px/ms 이상으로 튕기면 다음 칸이다', () => {
    expect(target(20, 0.3)).toBe(3)
    expect(target(-20, -0.3)).toBe(1)
  })

  it('끌다가 반대로 튕기면 끈 만큼을 되돌린다 — 다음 칸으로 가지 않는다', () => {
    expect(target(step * 0.4, -0.5)).toBe(2)
  })

  it('한 칸 넘게 끌면 지나친 칸을 세고 남은 거리로 다시 가른다', () => {
    expect(target(step * 1.05, 0)).toBe(3)
    expect(target(step * 1.2, 0)).toBe(4)
  })

  it('첫 칸 앞 · 끝 칸 뒤로 나가지 않는다', () => {
    expect(target(-step, -1, 0)).toBe(0)
    expect(target(step, 1, 5)).toBe(5)
    expect(target(step * 9, 0, 2)).toBe(5)
  })

  it('끌지 않았으면 그대로다', () => {
    expect(target(0, 0)).toBe(2)
  })
})
