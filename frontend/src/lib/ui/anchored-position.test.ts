import { describe, expect, it } from 'vitest'

import { anchoredPosition } from '@/lib/ui/anchored-position'

const VIEWPORT = { width: 1440, height: 900 }
const PANEL = { width: 320, height: 360 }

/** 화면 위쪽에 있는 입력 — 아래에 360 이 충분히 들어간다 */
const TOP_ANCHOR = { top: 100, bottom: 144, left: 200, width: 280 }

describe('anchoredPosition — 기본은 아래다', () => {
  it('아래 공간이 충분하면 입력 바로 아래 8px 에 붙인다', () => {
    const result = anchoredPosition(TOP_ANCHOR, PANEL, VIEWPORT)

    expect(result.placement).toBe('below')
    expect(result.top).toBe(152)
    expect(result.left).toBe(200)
  })

  it('패널이 입력보다 좁아도 입력 폭까지는 넓힌다', () => {
    const result = anchoredPosition(TOP_ANCHOR, PANEL, VIEWPORT)

    expect(result.minWidth).toBe(280)
  })
})

describe('anchoredPosition — 아래가 부족하면 뒤집는다', () => {
  it('아래가 모자라고 위가 넉넉하면 위로 붙인다', () => {
    // bottom 800, 뷰포트 900 → 아래 여유 92. 위는 756
    const anchor = { top: 756, bottom: 800, left: 200, width: 280 }

    const result = anchoredPosition(anchor, PANEL, VIEWPORT)

    expect(result.placement).toBe('above')
    // 756 - 8 - 360
    expect(result.top).toBe(388)
  })

  it('양쪽 다 모자라면 더 넓은 쪽을 쓴다', () => {
    // 위 200, 아래 656 → 둘 다 360 미만은 아니지만 아래가 넓다
    const anchor = { top: 208, bottom: 252, left: 200, width: 280 }
    const tall = { width: 320, height: 800 }

    const result = anchoredPosition(anchor, tall, VIEWPORT)

    expect(result.placement).toBe('below')
  })
})

describe('anchoredPosition — 좌우는 뷰포트 안으로 접는다', () => {
  it('왼쪽으로 넘치면 여백 8px 에 세운다', () => {
    const anchor = { top: 100, bottom: 144, left: -40, width: 280 }

    expect(anchoredPosition(anchor, PANEL, VIEWPORT).left).toBe(8)
  })

  it('오른쪽으로 넘치면 오른쪽 여백 8px 을 남기고 당긴다', () => {
    // 375px 모바일에서 입력이 오른쪽에 붙어 있는 경우
    const mobile = { width: 375, height: 812 }
    const anchor = { top: 100, bottom: 144, left: 180, width: 180 }

    // 375 - 320 - 8 = 47
    expect(anchoredPosition(anchor, PANEL, mobile).left).toBe(47)
  })

  it('패널이 뷰포트보다 넓으면 왼쪽 여백에 붙인다 (음수로 밀지 않는다)', () => {
    const narrow = { width: 300, height: 812 }
    const anchor = { top: 100, bottom: 144, left: 10, width: 280 }

    expect(anchoredPosition(anchor, PANEL, narrow).left).toBe(8)
  })
})
