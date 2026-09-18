import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { type ScrollRail, ScrollRailArrows } from '@/components/scroll-rail'

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
