import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MobileTabBar } from '@/features/nav/mobile-tab-bar'
import { readGlobalsCss } from '@/test/tokens'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

function render(path: string): string {
  pathname = path
  return renderToStaticMarkup(createElement(MobileTabBar, { authed: true }))
}

/*
  #1369 — 상세 화면에서는 탭바를 그리지 않는다. 장소 상세의 행동 바 위에 겹쳐 쌓여 화면의 17%를
  가렸다. 경로 판정 자체는 `lib/nav/tab-bar.test.ts` 가 본다 — 여기서는 배선과 CSS 짝만 잠근다.
*/
describe('MobileTabBar — 상세 화면에서 숨김 (#1369)', () => {
  beforeEach(() => {
    pathname = '/'
  })

  it('목록 화면에서는 그린다', () => {
    expect(render('/places')).toContain('data-tab-bar')
  })

  it.each(['/places/1', '/plans/1', '/plans/1/briefing', '/olle/1'])(
    '상세 화면에서는 아무것도 그리지 않는다: %s',
    (path) => {
      expect(render(path)).toBe('')
    },
  )

  /* 탭바가 없으면 자리도 비우지 않는다 — 표식(`data-tab-bar`)으로 재므로 경로를 CSS 에 다시 적지 않는다 */
  it('탭바가 없으면 --tabbar-h 가 0 이다', () => {
    expect(readGlobalsCss()).toMatch(
      /:root:not\(:has\(\[data-tab-bar\]\)\)\s*\{\s*--tabbar-h:\s*0px;\s*\}/,
    )
  })
})
