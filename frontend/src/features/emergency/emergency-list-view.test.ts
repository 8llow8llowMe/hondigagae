/**
 * 목록 갈래 레이아웃 회귀 — 이슈 #419 · #460.
 *
 * **소스를 문자열로 읽는다.** `EmergencyListView` 는 `useEmergencyBoard()` 가 위치·조회·
 * 라우터를 한꺼번에 잡고 있어 node 환경에서 렌더하려면 mock 이 넷 이상 필요한데, 여기서
 * 지키려는 것은 렌더 결과가 아니라 **레이아웃 계약**이다 —
 * 어느 요소가 grid 를 갖고, 무엇이 lg 에서 갈리고, 무엇이 카드 안팎에 서는가.
 * `content-max.test.ts` · `filter-rail-inset.test.ts` 가 쓰는 방식과 같다.
 *
 * **소스 단언은 블록 주석을 걷은 사본에 대해 한다** (#451 전례). 결정 주석이 `inset="main"` ·
 * `lg:border-l` 같은 값을 그대로 인용하므로 원문으로 보면 주석에 속아 통과한다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

const listView = source('src/features/emergency/emergency-list-view.tsx')
const mapView = source('src/features/emergency/emergency-map-view.tsx')
const page = source('app/(main)/emergency/page.tsx')

/** `export function <name>` 부터 다음 `export function` 직전까지 */
function block(code: string, name: string): string {
  const start = code.indexOf(`export function ${name}`)
  const rest = code.slice(start + 1)
  const end = rest.search(/\nexport function /)
  return end === -1 ? code.slice(start) : code.slice(start, start + 1 + end)
}

describe('목록 갈래가 필터 레일 2단을 쓴다 (#419)', () => {
  it('EmergencyListView 가 rail-layout grid 를 소유한다', () => {
    expect(listView).toContain('rail-layout rail-layout-filter')
  })

  /* `/places` 와 같은 갈림 — 레일은 lg 부터, 칩은 lg 미만 */
  it('레일은 hidden lg:block 이다', () => {
    expect(listView).toMatch(/rail-sticky[^"]*hidden lg:block/)
  })

  /*
    **`page.tsx` 는 더 이상 폭을 정하지 않는다.** `max-w-screen-md`(768) 가 1920 에서 목록만
    768 로 묶어 같은 화면의 보기 토글이 339px 옮겨 다녔다 (#419 실측).
  */
  it('page.tsx 의 className 에 max-w-screen-md 가 남아 있지 않다', () => {
    const classNames = [...page.matchAll(/className="([^"]*)"/g)].map((m) => m[1]).join(' ')

    expect(classNames).not.toContain('max-w-screen-md')
  })

  it('page.tsx 가 토글 링크를 목록 뷰에 넘긴다 — 지도 갈래와 같은 방식', () => {
    expect(page).toMatch(/<EmergencyListView[\s\S]{0,120}listHref/)
  })
})

/*
  **3층 표면** (`DESIGN.md §0`, #460 — 로드맵 #455 의 7번). 장소 목록(#439) · 일정 목록(#445)과
  같은 모양 — `main` 이 `Canvas`, 우측 열이 `SurfaceStack`, 목록이 `Surface` 하나, 칩은 카드 밖.
*/
describe('목록 갈래는 3층 표면이다 (#460)', () => {
  it('page.tsx 의 목록 갈래 main 이 Canvas 다 — 바닥은 전폭이어야 한다', () => {
    const listBranch = page.slice(page.lastIndexOf('return ('))

    expect(listBranch).toContain('<Canvas as="main" id="main-content">')
    expect(listBranch).toContain('<EmergencyListView')
  })

  it('지도 갈래 main 은 Canvas 가 아니다 — 지도가 바닥이다 (§7 전폭 예외)', () => {
    const mapBranch = page.slice(page.indexOf("if (view === 'map')"), page.lastIndexOf('return ('))

    expect(mapBranch).toContain('<main id="main-content">')
    expect(mapBranch).not.toContain('<Canvas')
  })

  it('우측 열이 SurfaceStack 이고 목록이 Surface 하나다', () => {
    const view = block(listView, 'EmergencyListView')

    expect(view).toContain('<SurfaceStack>')
    expect(view.match(/<Surface\b/g)?.length).toBe(1)
  })

  /* L0 바닥이 열 사이로 비쳐 그 일을 한다 — 선을 남기면 카드 테두리와 두 줄로 읽힌다 */
  it('열 구분선 lg:border-l 이 없다', () => {
    expect(listView).not.toContain('lg:border-l')
  })

  it('페이지 제목은 카드 제목이고 h1 은 sr-only 다 — 지도 갈래의 h1 과 같은 방식', () => {
    const view = block(listView, 'EmergencyListView')

    expect(view).toContain('<h1 className="sr-only">{messages.emergency.pageTitle}</h1>')
    expect(view).toMatch(/<Surface[\s\S]*?title=\{messages\.emergency\.pageTitle\}/)
    expect(page).toContain('<h1 className="sr-only">{messages.emergency.pageTitle}</h1>')
  })

  it('보기 토글과 부제는 카드 제목 줄에 있다', () => {
    const view = block(listView, 'EmergencyListView')

    expect(view).toMatch(/trailing=\{\s*<ViewToggle current="list"/)
    expect(view).toMatch(/description=\{[\s\S]*?emergencySummaryLine/)
  })

  /*
    **칩은 카드 밖이다.** 목록을 좁히는 도구이고 카드는 그 결과를 담는다 (#439 판단).
    소스 순서로 본다 — 칩이 `<Surface` 보다 앞에 오고 그 사이에 `</Surface>` 가 없다.
  */
  it('필터 칩이 Surface 밖에 서고 lg 에서 숨는다 — 레일과 같은 축을 두 번 보이지 않게', () => {
    const view = block(listView, 'EmergencyListView')
    const chips = view.indexOf('<EmergencyFilterChips')
    const surface = view.indexOf('<Surface\n')

    expect(chips).toBeGreaterThan(-1)
    expect(chips).toBeLessThan(surface)
    expect(view.slice(chips, surface)).toMatch(/className="lg:hidden"/)
  })

  /*
    **두 축의 기본값이 반대라 한쪽만 넘긴다** (#456①). `inset` 은 "카드 안인가" 를 물어
    기본이 `card` 고, `headingLevel` 은 "그 카드가 `h2` 를 갖는가" 를 물어 기본이 `2` 다.
    목록 갈래는 제목 있는 카드라 두 답이 갈린다 — `inset` 은 기본값 그대로, 레벨만 넘긴다.
  */
  it('목록 갈래는 inset 을 넘기지 않고 headingLevel 만 넘긴다', () => {
    const view = block(listView, 'EmergencyListView')

    expect(view).toMatch(/<EmergencyBoardSection board=\{board\} headingLevel=\{3\} \/>/)

    // 짝의 반대쪽 — 그 카드가 실제로 제목을 갖는다. 걷으면 레벨 단언이 함께 깨져야 한다
    expect(view).toMatch(/<Surface\b[\s\S]*?\btitle=/)
  })

  it('EmergencyBoardSection 이 inset 을 받아 EmergencySection 에 그대로 넘긴다', () => {
    const section = block(listView, 'EmergencyBoardSection')

    expect(section).toMatch(/inset = 'card'/)
    expect(section).toContain('inset={inset}')
    expect(section).not.toContain('hasRail')
  })
})

/*
  지도 SDK 실패 폴백은 `EmergencyBoardSection` 을 직접 쓴다. 두 함수가 갈려 있는 이유가
  그것이고(보드가 두 벌이 되면 위치를 두 번 묻는다), 그 갈래에는 레일도 카드도 없다 —
  카카오 키 도메인이 안 맞을 때 **항상** 오는 경로라 예외가 아니다 (공통명세 E0 · E5).
*/
describe('폴백 갈래는 레일도 카드도 얻지 않는다 (#419 · #460)', () => {
  const fallback = mapView.slice(
    mapView.indexOf('if (failure !== null)'),
    mapView.indexOf('const hideViewportClaim'),
  )

  it('EmergencyBoardSection 은 grid 를 갖지 않는다', () => {
    expect(block(listView, 'EmergencyBoardSection')).not.toContain('rail-layout')
  })

  it('폴백은 Canvas 도 Surface 도 그리지 않는다', () => {
    expect(fallback).not.toContain('<Canvas')
    expect(fallback).not.toContain('<Surface')
  })

  /* 카드가 아니므로 페이지 값 40 — 안내 줄(`md:px-10`)과 같은 축이어야 세로선이 맞는다 */
  it('폴백의 목록과 칩은 inset="main" 을 받고, 칩의 선은 divider 가 긋는다', () => {
    expect(fallback).toMatch(/<EmergencyBoardSection board=\{board\} inset="main" \/>/)
    expect(fallback).toMatch(/<EmergencyFilterChips[\s\S]*?inset="main"[\s\S]*?divider/)
    // 색 토큰은 className 으로 넘기지 않는다 (component-guide §3)
    expect(fallback).not.toMatch(/<EmergencyFilterChips[\s\S]*?className="[^"]*border/)
  })

  /* 폴백에는 레일이 없다 — 칩을 lg 에서 숨기면 데스크톱이 필터를 통째로 잃는다 */
  it('폴백의 칩은 lg:hidden 이 아니다', () => {
    const chips = fallback.slice(fallback.indexOf('<EmergencyFilterChips'))
    const tag = chips.slice(0, chips.indexOf('/>'))

    expect(tag).not.toContain('lg:hidden')
  })
})
