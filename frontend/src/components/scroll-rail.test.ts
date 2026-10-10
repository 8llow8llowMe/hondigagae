import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { railAlignScrollLeft, type ScrollRail, ScrollRailArrows } from '@/components/scroll-rail'

/**
 * 스크롤 레일 화살표 — [#730](https://github.com/8llow8llowMe/hondigagae/issues/730).
 *
 * **훅이 아니라 이 컴포넌트를 렌더한다.** `useScrollRail` 은 레이아웃을 재서 `fade` 를
 * 정하는데 node 환경에는 레이아웃이 없어 언제나 `none` 이다 — 그래서 실제 화면을 렌더하면
 * 화살표가 **한 번도 안 나온다** (`walk-times-section.test.ts` 가 곡선 대신 `scroll-rail`
 * 클래스를 세는 이유). `rail` 을 손으로 만들어 주면 두 배치를 그대로 볼 수 있다.
 */
function railStub(fade: ScrollRail['fade']): ScrollRail {
  return {
    ref: { current: null },
    fade,
    fadeClassName: '',
    onScroll: vi.fn(),
    page: vi.fn(),
  }
}

function render(fade: ScrollRail['fade'], placement?: 'overlay' | 'inline'): string {
  return renderToStaticMarkup(
    createElement(ScrollRailArrows, {
      rail: railStub(fade),
      prevLabel: '이전',
      nextLabel: '다음',
      ...(placement === undefined ? {} : { placement }),
    }),
  )
}

describe('ScrollRailArrows — 갈 수 있는 쪽에만 그린다', () => {
  it('양쪽으로 갈 수 있으면 둘 다 그린다', () => {
    const markup = render('both')

    expect(markup).toContain('aria-label="이전"')
    expect(markup).toContain('aria-label="다음"')
  })

  it('갈 곳이 없으면 아무것도 그리지 않는다', () => {
    expect(render('none')).toBe('')
  })
})

describe('ScrollRailArrows — placement (#730)', () => {
  /**
   * 기본은 오버레이다 — 이미 이 배치를 쓰는 다섯 호출처(필터 칩 · 지도 필터 · 혼잡도 ·
   * 권역 날씨 · 긴급 시설)가 조용히 바뀌면 안 된다.
   */
  it('기본은 오버레이다 — 떠서 좌우 끝에 앉는다', () => {
    const markup = render('both')

    expect(markup).toContain('scroll-rail-arrow')
    expect(markup).toContain('absolute')
    expect(markup).toContain('rounded-full')
    expect(markup).toContain('size-8')
  })

  /**
   * **`inline` 은 값을 가리지 않는다.** 오버레이 화살표가 골든타임 곡선의 온도 값 위에
   * 불투명하게 앉는 것이 이 이슈의 제보였다 — 레일 밖으로 나오면 가릴 칸이 없다.
   */
  it('inline 은 흐름에 선다 — 떠 있지 않다', () => {
    const markup = render('both', 'inline')

    expect(markup).not.toContain('absolute')
    expect(markup).not.toContain('-translate-y-1/2')
  })

  /**
   * **터치에서도 남는다.** `.scroll-rail-arrow` 가 `pointer: coarse` 에서 숨기는데, 그
   * 근거 둘(*"항목을 하나씩 가린다"* · *"32px 이 44 에 못 미친다"*)이 여기서는 성립하지
   * 않는다 — 그래서 그 클래스를 붙이지 않고 44×44 를 지킨다 (DESIGN.md §7).
   */
  it('inline 은 44×44 이고 터치에서 숨는 클래스를 붙이지 않는다', () => {
    const markup = render('both', 'inline')

    expect(markup).toContain('size-11')
    expect(markup).not.toContain('scroll-rail-arrow')
  })

  /**
   * **원형 예외를 가져오지 않는다.** DESIGN.md §5 에서 `rounded-full` 은 사진·아바타
   * 몫이고, 오버레이가 그것을 쓰는 근거는 "면 위에 떠 있다" 였다. 흐름에 선 버튼은
   * 그냥 버튼이라 곡률 8 이다.
   */
  it('inline 은 곡률 8 이다 — 원형 예외를 물려받지 않는다', () => {
    const markup = render('both', 'inline')

    expect(markup).toContain('rounded-md')
    expect(markup).not.toContain('rounded-full')
  })

  /** 이름은 배치와 무관하다 — 아이콘만 있는 버튼이라 `aria-label` 이 유일한 이름이다 */
  it('배치가 달라도 접근 이름은 같다', () => {
    const markup = render('both', 'inline')

    expect(markup).toContain('aria-label="이전"')
    expect(markup).toContain('aria-label="다음"')
  })
})

/**
 * 레일의 **초기 위치** — [#671](https://github.com/8llow8llowMe/hondigagae/issues/671) **F-1**.
 *
 * 레일은 여태 언제나 `scrollLeft: 0` 이라 **가장 이른 = 가장 나쁜 시각**에서 시작했다.
 * 1280 실측(골든타임 창 17–21시)에서 보이는 것은 `14·15·16`(면 없음) + `17시`(황갈) +
 * `18시` 21px 뿐이고 전부 안전인 `19·20·21시` 는 화면 밖이었다 — 면이 한 톤이던 때는
 * 문제가 아니었지만, 칸마다 등급이 실린 뒤로는 접힘이 **사용자가 보는 것을 체계적으로
 * 나쁜 쪽으로 치우치게 한다.**
 *
 * **훅이 아니라 이 순수 함수를 부른다.** node 환경에는 레이아웃이 없어 `useScrollRail` 을
 * 렌더해도 폭이 전부 0 이고, 그러면 어느 갈래도 밟히지 않아 단언이 공허해진다. 옮길지
 * 말지의 **판단**을 함수로 빼 둔 이유가 그것이다.
 */
describe('railAlignScrollLeft — 마운트 시 한 번만 옮긴다 (#671 F-1)', () => {
  /** 곡선 8칸(56px) 중 17시가 창의 시작인 모양. 레일은 300px 만 보인다 */
  const RAIL = { containerWidth: 300, scrollWidth: 448, targetWidth: 56 }

  it('대상이 보이도록 옮긴다 — 0 에서 시작하지 않는다', () => {
    const left = railAlignScrollLeft({ ...RAIL, aligned: false, targetLeft: 168 })

    expect(left).not.toBeNull()
    expect(left).toBeGreaterThan(0)
    // 대상(168~224)이 보이는 창(left ~ left+300) 안에 든다
    expect(left ?? 0).toBeLessThanOrEqual(168)
    expect((left ?? 0) + 300).toBeGreaterThanOrEqual(224)
  })

  /**
   * **이것이 F-1 의 나머지 절반이다.** 한 번 옮긴 뒤 다시 옮기면 사용자가 스크롤한 자리에서
   * 레일이 튄다 — 훅의 효과에는 의존성 배열이 없어 매 렌더 뒤에 다시 돌기 때문에, 빗장이
   * 없으면 리렌더마다 제자리로 끌려간다.
   */
  it('이미 옮겼으면 다시 옮기지 않는다', () => {
    expect(railAlignScrollLeft({ ...RAIL, aligned: true, targetLeft: 168 })).toBeNull()
  })

  it('대상이 없으면 옮기지 않는다 — 창이 없는 날이 그렇다', () => {
    expect(railAlignScrollLeft({ ...RAIL, aligned: false, targetLeft: null })).toBeNull()
  })

  /**
   * **레이아웃 전에는 빗장을 걸지 않는다.** 폭이 0 인 채로 재면 `centerScrollLeft` 의
   * clamp 가 0 을 내는데, 그 0 으로 "옮겼다" 고 표시하면 **영영 0 에 고정**된다 —
   * 옮길 수 없는 것과 옮기지 않기로 한 것은 다르다.
   */
  it('아직 레이아웃이 없으면(폭 0) 옮기지 않는다', () => {
    expect(
      railAlignScrollLeft({
        aligned: false,
        containerWidth: 0,
        scrollWidth: 0,
        targetLeft: 168,
        targetWidth: 0,
      }),
    ).toBeNull()
  })

  /** 스크롤 여지를 넘지 않는다 — 셈은 `lib/ui/scroll.ts` 의 clamp 가 갖는다 */
  it('마지막 칸이 대상이어도 스크롤 끝을 넘지 않는다', () => {
    const left = railAlignScrollLeft({ ...RAIL, aligned: false, targetLeft: 392 })

    expect(left).toBe(448 - 300)
  })
})
