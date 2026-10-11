import { describe, expect, it } from 'vitest'

import { hidesTabBar } from '@/lib/nav/tab-bar'

describe('hidesTabBar (#1369)', () => {
  it.each([
    '/places/212481712381923328',
    '/plans/223456789012000001',
    '/plans/223456789012000001/briefing',
    '/plans/223456789012000001/emergency',
    '/plans/223456789012000001/days/2/add',
    '/plans/223456789012000001/days/2/regenerate',
    '/olle/12',
  ])('상세 · 일정의 작업 화면은 숨긴다: %s', (pathname) => {
    expect(hidesTabBar(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/places',
    '/plans',
    '/plans/new',
    '/olle',
    '/mypage',
    '/pets/1',
    '/favorites',
    '/emergency',
    '/ai-plans/new',
    '/shared-plans/abc',
    '/placesx/1',
  ])('탭 사이를 오가는 화면은 남긴다: %s', (pathname) => {
    expect(hidesTabBar(pathname)).toBe(false)
  })

  /* 장소 · 코스는 상세 한 단만이다 — 더 깊은 경로는 지금 없고, 생기면 그때 정한다 */
  it('장소 · 코스는 상세 한 단만 본다', () => {
    expect(hidesTabBar('/places/1/extra')).toBe(false)
    expect(hidesTabBar('/olle/1/extra')).toBe(false)
  })

  it('끝 슬래시를 견딘다', () => {
    expect(hidesTabBar('/places/1/')).toBe(true)
  })
})
