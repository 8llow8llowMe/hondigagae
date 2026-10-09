import { describe, expect, it } from 'vitest'

import { menuPlacement } from '@/lib/ui/menu-placement'

/**
 * 칩 메뉴를 위로 여나 아래로 여나 — 장소-반려견칩-세부명세 D1-2 · D7-4.
 *
 * 여유는 양쪽 모두 8 을 남기고 잰다: 아래 = `viewportBottom − triggerBottom − 8`, 위 = `triggerTop − 8`.
 */
describe('menuPlacement', () => {
  it('아래 여유가 패널 높이보다 넉넉하면 아래다', () => {
    expect(
      menuPlacement({ triggerTop: 200, triggerBottom: 244, panelHeight: 143, viewportBottom: 800 }),
    ).toBe('below')
  })

  it('아래가 모자라고 위가 넉넉하면 위다 — 시트 min 단계에서 탭바에 가리지 않는다', () => {
    expect(
      menuPlacement({ triggerTop: 640, triggerBottom: 684, panelHeight: 143, viewportBottom: 748 }),
    ).toBe('above')
  })

  it('둘 다 모자라면 더 넓은 쪽이다', () => {
    // 아래 여유 92 · 위 여유 72 → 아래
    expect(
      menuPlacement({ triggerTop: 80, triggerBottom: 124, panelHeight: 290, viewportBottom: 224 }),
    ).toBe('below')
    // 아래 여유 52 · 위 여유 112 → 위
    expect(
      menuPlacement({ triggerTop: 120, triggerBottom: 164, panelHeight: 290, viewportBottom: 224 }),
    ).toBe('above')
  })

  it('아래 여유가 패널 높이와 정확히 같으면 아래다', () => {
    // 아래 여유 = 395 − 244 − 8 = 143
    expect(
      menuPlacement({ triggerTop: 600, triggerBottom: 244, panelHeight: 143, viewportBottom: 395 }),
    ).toBe('below')
  })

  it('둘 다 모자라고 여유가 같으면 아래다 — 기본 쪽으로 기운다', () => {
    // 아래 50 · 위 50
    expect(
      menuPlacement({ triggerTop: 58, triggerBottom: 102, panelHeight: 143, viewportBottom: 160 }),
    ).toBe('below')
  })
})
