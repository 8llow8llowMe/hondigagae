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
    expect(listView).toMatch(/rail-column[^"]*hidden lg:block/)
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

    /* #546 에서 건너뛰기 목적지가 되며 `id` · `tabIndex` · `md:pt-0` 이 붙었다 */
    expect(view).toMatch(/<SurfaceStack\b/)
    expect(view.match(/<Surface\b(?!Stack)/g)?.length).toBe(1)
  })

  /* L0 바닥이 열 사이로 비쳐 그 일을 한다 — 선을 남기면 카드 테두리와 두 줄로 읽힌다 */
  it('열 구분선 lg:border-l 이 없다', () => {
    expect(listView).not.toContain('lg:border-l')
  })

  /*
    **#537 — 제목이 필터보다 먼저다.** 예전에는 카드 위에 칩이 깔리고 제목이 카드의 `h2`
    였다: 375 에서 페이지에 들어온 사용자가 "여기가 어디인가" 를 알기 전에 필터 두 줄을
    지났다. 급할 때 여는 화면이라 그 순서가 특히 나빴다.

    **#556 이 그 제목을 카드 **머리** 로 되돌렸다.** 되돌린 것이 아니라 자리가 바뀐 것이다 —
    머리 안에서도 제목은 필터(칩)보다 위이고, 이제 제목·도구·목록이 한 표면 안에 든다.
    `h1` 은 `sr-only` 로 격자 맨 앞에 남아 레일보다 앞선다 (#546 이 `.rail-heading` 으로
    풀던 문제를 같은 결과로 푼다).
  */
  it('h1 은 sr-only 로 레일 앞에 서고 보이는 제목은 카드의 h2 다 (#556)', () => {
    const view = block(listView, 'EmergencyListView')

    const h1 = view.indexOf('<h1 className="sr-only">')
    const aside = view.indexOf('<aside')

    expect(h1).toBeGreaterThan(-1)
    /* 소스 순서가 곧 DOM 순서다 — `h1` → 레일 → 목록 */
    expect(h1).toBeLessThan(aside)

    // 보이는 제목은 카드가 그린다. `aria-label` 과 함께 주면 이름이 둘이 된다
    expect(view).toMatch(/title=\{messages\.emergency\.pageTitle\}/)
    expect(view).not.toMatch(/<Surface\b[\s\S]*?aria-label=/)

    // 지도 갈래도 sr-only h1 이다 — 두 갈래가 같은 h1 을 내야 전환이 구조를 안 바꾼다
    expect(page).toContain('<h1 className="sr-only">{messages.emergency.pageTitle}</h1>')
  })

  /*
    **부제는 개수 한 줄이다** (#639). "제주 214곳 · 지금 진료중 100곳" 은 이 화면에 온
    이유 자체라 모든 폭에서 선다.

    **데스크톱 전용 조건 줄(`emergencySummaryLine`, #419)은 걷었다** — 1280 실측에서
    `10.0km` 홀로 서서 무슨 값인지 읽히지 않았다. 반경은 좌측 레일의 선택값과 목록 위
    요약 줄(`가까운 순 · 반경 10.0km`)이 이미 말한다. 되돌아오면 같은 결함이 다시 선다.
  */
  it('보기 토글과 부제 한 줄이 카드 머리 슬롯에 있다 (#556 · #639)', () => {
    const view = block(listView, 'EmergencyListView')

    // 카드 밖 제목 줄의 형제가 아니라 카드의 슬롯이다
    expect(view).toMatch(/trailing=\{\s*<ViewToggle current="list"/)
    expect(view).toContain('const subtitle = emergencyHeadSubtitle(result)')
    expect(view).toMatch(/description=\{[\s\S]{0,200}\{subtitle\}/)

    // `lg:` 로 갈리는 둘째 부제가 되돌아오면 여기서 걸린다
    expect(listView).not.toContain('emergencySummaryLine')
  })

  /*
   **칩은 카드 머리의 `tools` 슬롯이다** (#556). 목록을 좁히는 도구와 그 결과를 가르는 축이
   "카드 안/밖" 에서 "머리/본문" 으로 옮겨 갔다 (`Surface` 의 `fill` 절).
   */
  /*
    **위치 폴백 블록이 도구보다 위다** (#639). 칩·검색은 결과를 *좁히는* 도구지만
    이 블록은 **무엇을 기준으로 찾을지** — 결과의 전제다. 머리(고정 영역)라 목록을
    굴려도 남는다: 예전 `PositionNotice` 는 본문 맨 위였고 스크롤 한 번이면 사라졌다.
  */
  it('위치 폴백 머리가 tools 슬롯 맨 위에 선다 (#639)', () => {
    const view = block(listView, 'EmergencyListView')
    const tools = view.indexOf('tools={')
    const head = view.indexOf('<PositionFallbackHead')
    const search = view.indexOf('<EmergencySearchField')

    expect(head).toBeGreaterThan(tools)
    expect(search).toBeGreaterThan(head)

    const tag = view.slice(head, view.indexOf('/>', head))
    expect(tag).toContain('reason={board.fallback}')
    expect(tag).toContain('onRegionChange={board.researchAtRegion}')
    // 목록 본문에 같은 안내가 남으면 같은 말을 두 번 한다
    expect(listView).not.toContain('positionFallback=')
  })

  it('필터 칩이 카드 머리의 tools 슬롯에 서고 lg 에서 숨는다', () => {
    const view = block(listView, 'EmergencyListView')
    const tools = view.indexOf('tools={')
    const chips = view.indexOf('<EmergencyFilterChips')

    expect(tools).toBeGreaterThan(-1)
    expect(chips).toBeGreaterThan(tools)
    expect(view.slice(chips)).toMatch(/className="lg:hidden"/)
  })

  /*
    **검색은 같은 `tools` 슬롯이지만 `lg:hidden` 이 아니다** (#584).

    칩은 레일이 같은 축을 두 번 보여주지 않도록 데스크톱에서 숨지만 **검색은 레일에 짝이
    없다** — 레일(`hidden lg:block`)에 넣으면 1024 미만에서 통째로 사라진다. 이 화면에서
    가장 다툴 만한 결정이고(이슈 본문은 "필터 레일과 모바일 필터 시트" 를 적었다),
    `className="lg:hidden"` 한 줄이면 조용히 뒤집힌다.
  */
  it('검색이 tools 슬롯 안에서 칩보다 위에 서고 lg 에서 숨지 않는다', () => {
    const view = block(listView, 'EmergencyListView')
    const tools = view.indexOf('tools={')
    const search = view.indexOf('<EmergencySearchField')
    const chips = view.indexOf('<EmergencyFilterChips')

    expect(search).toBeGreaterThan(tools)
    expect(chips).toBeGreaterThan(search)

    const tag = view.slice(search, view.indexOf('/>', search))
    expect(tag).not.toContain('lg:hidden')
    // 카드 머리는 좌우 여백 밖이라 도구가 인셋을 스스로 든다 (`Surface` 머리주석)
    expect(tag).toContain('INSET_CLASS.card')
  })

  /* 반경 축이 모바일에도 올라왔다 (#537) — 데스크톱 레일만 갖고 있던 손잡이다 */
  it('모바일 칩이 반경 축을 보드에서 받는다', () => {
    const view = block(listView, 'EmergencyListView')
    const chips = view.slice(view.indexOf('<EmergencyFilterChips'))
    const tag = chips.slice(0, chips.indexOf('/>'))

    expect(tag).toContain('radius={board.radius}')
    expect(tag).toContain('onRadiusChange={board.setRadius}')
  })

  /*
    **두 축의 기본값이 반대라 한쪽만 넘긴다** (#456①). `inset` 은 "카드 안인가" 를 물어
    기본이 `card` 고, `headingLevel` 은 "그 카드가 `h2` 를 갖는가" 를 물어 기본이 `2` 다.
    **#556 으로 카드가 제목을 되찾아 두 답이 다시 갈렸다** — 카드가 `h2` 를 그리므로
    상태 제목은 한 단 내려간 `3` 이다.
  */
  it('카드가 제목을 되찾았으므로 상태 제목이 h3 다', () => {
    const view = block(listView, 'EmergencyListView')

    expect(view).toMatch(/<EmergencyBoardSection board=\{board\} headingLevel=\{3\} \/>/)

    // 짝의 반대쪽 — 그 카드가 실제로 제목을 갖는다. 도로 걷으면 레벨 단언이 함께 깨진다
    expect(view).toMatch(/title=\{messages\.emergency\.pageTitle\}/)
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

  /*
    **폴백에도 검색이 남는다** (#584). 이 갈래는 목록 갈래를 통째로 대체하므로, 검색을
    빼면 `?keyword=` 를 달고 들어온 사용자가 그것을 지울 방법이 없다 —
    `EmergencyFilterChips` 에는 `초기화` 가 없고 0건일 때의 완화 버튼뿐이다.
  */
  it('폴백에 검색이 남고 lg:hidden 이 아니다', () => {
    const search = fallback.indexOf('<EmergencySearchField')
    expect(search).toBeGreaterThan(-1)

    const tag = fallback.slice(search, fallback.indexOf('/>', search))
    expect(tag).not.toContain('lg:hidden')
    // 카드 없는 페이지라 인셋은 칩·목록과 같은 `main` 이다
    expect(tag).toContain('INSET_CLASS.main')
  })

  /* 폴백에는 레일이 없다 — 칩을 lg 에서 숨기면 데스크톱이 필터를 통째로 잃는다 */
  it('폴백의 칩은 lg:hidden 이 아니다', () => {
    const chips = fallback.slice(fallback.indexOf('<EmergencyFilterChips'))
    const tag = chips.slice(0, chips.indexOf('/>'))

    expect(tag).not.toContain('lg:hidden')
  })
})

/*
  **제목이 필터보다 먼저 읽혀야 한다** — 이슈 #546.

  #472 가 `/places` · `/plans` · 담기 셋에 준 처방(랜드마크 · 건너뛰기 링크 · `h1` 을 앞으로)을
  이 화면에도 적용한다. 1280 실측 개요가 `h2 필터 → h3 셋 → h1 병원 · 약국` 이었다.

  **실제 순서와 자리는 `e2e/surface.spec.ts` 가 잰다.** 여기서 잠그는 것은 소스에 그 계약이
  적혀 있는가다 — 랜드마크·링크·목적지는 셋이 짝이라 하나만 빠져도 조용히 무효가 된다.
*/
describe('제목이 필터보다 먼저다 (#546)', () => {
  const view = block(listView, 'EmergencyListView')

  it('레일이 라벨 붙은 aside 다', () => {
    expect(view).toMatch(/<aside\s+aria-label=\{messages\.place\.filterTitle\}/)
    /* 랜드마크가 아니면 보조기기가 이 구간을 통째로 건너뛸 수 없다 */
    expect(view).not.toMatch(/<div className="rail-sticky/)
  })

  it('건너뛰기 링크가 레일 안 맨 앞이다', () => {
    const aside = view.slice(view.indexOf('<aside'))
    const skip = aside.indexOf('<SkipLink')
    const rail = aside.indexOf('<EmergencyFilterRail')

    expect(skip).toBeGreaterThan(-1)
    expect(skip).toBeLessThan(rail)
  })

  /*
    **목적지 id 를 두 곳에 적지 않는다.** 링크와 `SurfaceStack` 이 같은 상수를 쓴다 —
    문자열을 복제하면 갈렸을 때 링크가 조용히 아무 데도 가지 않는다.
  */
  it('링크와 목적지가 같은 상수를 쓴다', () => {
    expect(listView).toContain("const LIST_ANCHOR_ID = 'emergency-list'")
    expect(view).toContain('<SkipLink href={`#${LIST_ANCHOR_ID}`}>')
    expect(view).toMatch(/<SurfaceStack id=\{LIST_ANCHOR_ID\} tabIndex=\{-1\}/)
  })

  /*
    **`.rail-heading` 이 사라졌다** (#556). #546 이 제목 줄을 두 열 위에 얹어 DOM 순서를
    바로잡았는데, 제목이 카드 머리로 내려가고 `sr-only h1` 이 그 자리를 대신하면서 그 클래스를
    쓰는 곳이 없어졌다 — globals.css 에서도 걷었다.
  */
  it('rail-heading 을 더 이상 쓰지 않는다', () => {
    expect(view).not.toContain('rail-heading')
  })

  /* `list-column`(globals.css)이 열 높이를 잡고, 카드가 `fill` 로 그것을 채운다 (#553 · #556) */
  it('우측 스택이 list-column 이고 카드가 fill 이다', () => {
    expect(view).toMatch(/<SurfaceStack[^>]*className="list-column"/)
    expect(view).toMatch(/<Surface\s+fill/)
  })
})

/*
  **지도 갈래의 검색 자리** — 이슈 #584.

  `/places`(#431)가 "지도 갈래에는 두지 않는다" 로 접었던 결정을 뒤집은 자리라, 무엇을
  근거로 뒤집었고 자리가 왜 둘인지가 소스에 남아야 한다. 두 자리는 **동시에 렌더되고
  CSS 로만 갈린다** — `/places` 지도가 패널과 시트를 그렇게 두는 것과 같다.
*/
describe('지도 갈래는 검색을 두 자리에 둔다 (#584)', () => {
  /* 오버레이는 지도 위 떠 있는 줄, 패널은 그 뒤 — `map-panel-width` 가 경계다 */
  const overlay = mapView.slice(
    mapView.indexOf('pointer-events-none absolute inset-x-0 top-5'),
    mapView.indexOf('map-panel-width'),
  )

  /* 1024 미만 전용 — 그 위는 좌측 패널이 같은 일을 한다. 둘 다 그리면 검색창이 둘이다 */
  it('오버레이 검색은 보기 토글보다 앞이고 lg 에서 숨는다', () => {
    const search = overlay.indexOf('<EmergencySearchField')
    const toggle = overlay.indexOf('<ViewToggle')

    expect(search).toBeGreaterThan(-1)
    expect(toggle).toBeGreaterThan(search)

    const tag = overlay.slice(search, overlay.indexOf('/>', search))
    expect(tag).toContain('lg:hidden')
    // 375 에 245 밖에 없다 — 글자 버튼이면 입력이 177 로 줄어 placeholder 가 잘린다
    expect(tag).toContain('compact')
    // 768 에서 538 로 벌어지지 않게 상한을 둔다
    expect(tag).toContain('max-w-md')
  })

  /* 패널 툴바 안쪽이 374 라 목록 갈래 모바일 검색(343)보다 넓다 — 줄일 이유가 없다 */
  it('패널 검색은 필터바보다 위이고 compact 가 아니다', () => {
    const panel = mapView.slice(mapView.indexOf('map-panel-width'))
    const search = panel.indexOf('<EmergencySearchField')
    const toolbar = panel.indexOf('{toolbar}')

    expect(search).toBeGreaterThan(-1)
    expect(toolbar).toBeGreaterThan(search)

    const tag = panel.slice(search, panel.indexOf('/>', search))
    expect(tag).not.toContain('compact')
  })

  /*
    **두 검색이 동시에 문서에 있다** — 같은 `id` 면 `htmlFor` 가 어느 입력을 가리키는지
    문서가 정하지 못하고, 보조기기가 라벨 없는 입력을 하나 보게 된다.
  */
  it('두 자리의 입력 id 가 다르다', () => {
    expect(mapView).toContain('id="emergency-keyword-map"')
    expect(mapView).toContain('id="emergency-keyword-panel"')
  })
})
