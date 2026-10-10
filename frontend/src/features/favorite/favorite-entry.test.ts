import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { MyFavoritesRow } from '@/features/member/my-favorites-row'
import { ACCOUNT_MENU_ITEMS } from '@/features/nav/menu-items'
import { messages } from '@/lib/messages'

import { config as proxyConfig, PROTECTED_PATHS } from '../../../proxy'

/**
 * 진입점과 보호 경로 — 이슈 #127 의 체크리스트가 이 둘을 따로 적었다.
 *
 * **보호 경로 등록을 빼먹으면 로그인 없이 접근된다** (`proxy.ts` 주석 · auth-guide.md §5).
 * 화면이 늘 때마다 사람이 기억해야 하는 일이라 테스트로 묶는다.
 */
describe('/favorites — 보호 경로 등록', () => {
  it('PROTECTED_PATHS 에 있다', () => {
    expect(PROTECTED_PATHS).toContain('/favorites')
  })

  it('proxy matcher 에도 있다 — 목록에만 넣으면 proxy 가 아예 실행되지 않는다', () => {
    expect(proxyConfig.matcher).toContain('/favorites/:path*')
  })
})

describe('/favorites — 진입점 (아트보드 "모바일: 내 정보 탭 · 데스크톱: 아바타 팝오버")', () => {
  it('데스크톱 아바타 팝오버에 있다', () => {
    const hrefs = ACCOUNT_MENU_ITEMS.map((item) => item.href)

    expect(hrefs).toContain('/favorites')
  })

  it('모바일 탭바를 늘리지 않는다 — 4개 고정 (전역nav-세부명세 D4-1)', async () => {
    const { MOBILE_TAB_ITEMS } = await import('@/features/nav/menu-items')

    expect(MOBILE_TAB_ITEMS).toHaveLength(4)
    expect(MOBILE_TAB_ITEMS.map((item) => item.href)).not.toContain('/favorites')
  })
})

describe('MyFavoritesRow — 마이페이지 행', () => {
  function render(totalCount: number | null) {
    return renderToStaticMarkup(createElement(MyFavoritesRow, { totalCount }))
  }

  it('개수를 보여 준다 — 들어가기 전에 안이 비었는지 알 수 있어야 한다', () => {
    expect(render(12)).toContain('12/100곳')
  })

  it('0곳과 조회 실패를 같은 문구로 뭉개지 않는다', () => {
    expect(render(0)).toContain(messages.favorite.entryEmpty)
    expect(render(null)).not.toContain(messages.favorite.entryEmpty)
  })

  it('조회 실패에도 진입점은 남는다 — 목록이 안 열리는 것과 진입점이 사라지는 것은 다르다', () => {
    const markup = render(null)

    expect(markup).toContain(messages.favorite.entryLabel)
    expect(markup).toContain('href="/favorites"')
  })

  it('이동이라 링크다 — 버튼이 아니다 (D6)', () => {
    const markup = render(12)

    expect(markup).toContain('<a')
    expect(markup).not.toContain('<button')
  })
})
