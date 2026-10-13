import { describe, expect, it } from 'vitest'

import { EDITOR_MIN_VISIBLE_PX, editorTopNeedsReveal } from '@/lib/plan/edit-reveal'

const VIEWPORT = 844
const HEADER = 56

describe('editorTopNeedsReveal — 편집을 연 직후 편집 영역 머리가 보이는가 (#1427)', () => {
  it('머리가 헤더 아래 · 화면 안에 있으면 건드리지 않는다 — 보이는 화면을 굳이 움직이지 않는다', () => {
    expect(editorTopNeedsReveal({ top: 200, viewportHeight: VIEWPORT, headerHeight: HEADER })).toBe(
      false,
    )
  })

  it('머리가 고정 헤더 뒤로 올라갔으면 끌어내린다 — 긴 목록이 짧은 편집기로 바뀌면 생긴다', () => {
    expect(editorTopNeedsReveal({ top: 40, viewportHeight: VIEWPORT, headerHeight: HEADER })).toBe(
      true,
    )
    expect(
      editorTopNeedsReveal({ top: -300, viewportHeight: VIEWPORT, headerHeight: HEADER }),
    ).toBe(true)
  })

  it('헤더 바로 아래 경계는 보이는 것으로 본다', () => {
    expect(
      editorTopNeedsReveal({ top: HEADER, viewportHeight: VIEWPORT, headerHeight: HEADER }),
    ).toBe(false)
  })

  it('머리가 화면 아래 끝에 겨우 걸려 첫 행이 안 보이면 끌어올린다', () => {
    const top = VIEWPORT - EDITOR_MIN_VISIBLE_PX + 1

    expect(editorTopNeedsReveal({ top, viewportHeight: VIEWPORT, headerHeight: HEADER })).toBe(true)
    expect(
      editorTopNeedsReveal({ top: VIEWPORT + 50, viewportHeight: VIEWPORT, headerHeight: HEADER }),
    ).toBe(true)
  })

  it('아래 여유가 꼭 첫 행만큼이면 보이는 것으로 본다', () => {
    const top = VIEWPORT - EDITOR_MIN_VISIBLE_PX

    expect(editorTopNeedsReveal({ top, viewportHeight: VIEWPORT, headerHeight: HEADER })).toBe(
      false,
    )
  })
})
