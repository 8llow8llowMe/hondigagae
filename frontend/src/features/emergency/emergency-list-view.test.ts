/**
 * 목록 갈래 레이아웃 회귀 — 이슈 #419.
 *
 * **소스를 문자열로 읽는다.** `EmergencyListView` 는 `useEmergencyBoard()` 가 위치·조회·
 * 라우터를 한꺼번에 잡고 있어 node 환경에서 렌더하려면 mock 이 넷 이상 필요한데, 여기서
 * 지키려는 것은 렌더 결과가 아니라 **레이아웃 계약**이다 —
 * 어느 요소가 grid 를 갖고, 무엇이 lg 에서 갈리는가.
 * `content-max.test.ts` · `filter-rail-inset.test.ts` 가 쓰는 방식과 같다.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8')
}

const listView = source('src/features/emergency/emergency-list-view.tsx')
const page = source('app/(main)/emergency/page.tsx')

describe('목록 갈래가 필터 레일 2단을 쓴다 (#419)', () => {
  it('EmergencyListView 가 rail-layout grid 를 소유한다', () => {
    expect(listView).toContain('rail-layout rail-layout-filter')
  })

  /* `/places` 와 같은 갈림 — 레일은 lg 부터, 칩은 lg 미만 */
  it('레일은 hidden lg:block 이다', () => {
    expect(listView).toMatch(/rail-sticky[^"]*hidden lg:block/)
  })

  it('열 구분선은 우측 열의 border-left 가 그린다', () => {
    expect(listView).toContain('lg:border-l')
  })

  /*
    **`page.tsx` 는 더 이상 폭을 정하지 않는다.** `max-w-screen-md`(768) 가 1920 에서 목록만
    768 로 묶어 같은 화면의 보기 토글이 339px 옮겨 다녔다 (#419 실측).
  */
  it('page.tsx 의 className 에 max-w-screen-md 가 남아 있지 않다', () => {
    // 주석에는 남아 있다 — 왜 없앴는지가 그 자리에 있어야 한다. 계약은 실제 클래스다
    const classNames = [...page.matchAll(/className="([^"]*)"/g)].map((m) => m[1]).join(' ')

    expect(classNames).not.toContain('max-w-screen-md')
  })

  it('page.tsx 가 토글 링크를 목록 뷰에 넘긴다 — 지도 갈래와 같은 방식', () => {
    expect(page).toMatch(/<EmergencyListView[\s\S]{0,120}listHref/)
  })
})

describe('폴백 갈래는 레일을 얻지 않는다 (#419)', () => {
  /*
    지도 SDK 실패 폴백은 `EmergencyBoardSection` 을 직접 쓴다. 두 함수가 갈려 있는 이유가
    그것이고(보드가 두 벌이 되면 위치를 두 번 묻는다), 그 갈래에는 레일이 없어야 한다.
  */
  it('EmergencyBoardSection 은 grid 를 갖지 않는다', () => {
    const boardSection = listView.slice(listView.indexOf('export function EmergencyBoardSection'))

    expect(boardSection).not.toContain('rail-layout')
  })
})

describe('칩 숨김은 레일이 있는 갈래에만 건다 (#419)', () => {
  const section = source('src/features/emergency/emergency-section.tsx')

  /*
    **폴백에는 레일이 없다.** 칩을 무조건 `lg:hidden` 으로 만들면 지도 SDK 실패 경로가
    데스크톱에서 필터를 통째로 잃는다 — 카카오 키 도메인이 안 맞을 때 **항상** 오는 경로라
    예외가 아니다. 그래서 숨김은 호출부가 정한다.
  */
  it('EmergencySection 이 hasRail 을 받는다', () => {
    expect(section).toContain('hasRail')
  })

  it('칩 숨김이 hasRail 에 걸려 있다 — 무조건 lg:hidden 이 아니다', () => {
    expect(section).toMatch(/hasRail[\s\S]{0,80}lg:hidden/)
  })

  it('목록 갈래는 hasRail 을 켠다', () => {
    expect(listView).toMatch(/hasRail/)
  })
})
