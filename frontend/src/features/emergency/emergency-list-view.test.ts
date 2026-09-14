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

    **그래서 `h1` 이 `sr-only` 를 벗고 보이는 제목이 됐다.** 카드는 제목을 잃고
    `aria-label` 로 이름을 갖는다 — 제목과 `aria-label` 을 함께 주면 접근성 이름이 둘이
    된다 (`Surface` 머리주석).
  */
  it('h1 이 보이는 제목이고 카드는 aria-label 로 이름을 갖는다 (#537)', () => {
    const view = block(listView, 'EmergencyListView')

    expect(view).toMatch(
      /<h1 className="text-title-1[^"]*">\s*\{messages\.emergency\.pageTitle\}\s*<\/h1>/,
    )
    expect(view).not.toContain('<h1 className="sr-only">')

    expect(view).toMatch(/<Surface aria-label=\{messages\.emergency\.pageTitle\}>/)
    // 제목을 도로 카드에 넣으면 이름이 둘이 된다
    expect(view).not.toMatch(/<Surface\b[\s\S]*?\btitle=/)

    // 지도 갈래는 그대로 sr-only h1 이다 — 두 갈래가 같은 h1 을 내야 전환이 구조를 안 바꾼다
    expect(page).toContain('<h1 className="sr-only">{messages.emergency.pageTitle}</h1>')
  })

  it('보기 토글과 부제가 카드 밖 제목 줄에 있다 (#537)', () => {
    const view = block(listView, 'EmergencyListView')

    const title = view.indexOf('<h1 className="text-title-1')
    const surface = view.indexOf('<Surface ')

    // 카드의 슬롯이 아니라 제목 줄의 형제다
    expect(view).not.toMatch(/trailing=\{/)
    expect(view).not.toMatch(/description=\{/)

    for (const mark of ['<ViewToggle current="list"', 'emergencySummaryLine']) {
      const at = view.indexOf(mark)
      expect(at).toBeGreaterThan(title)
      expect(at).toBeLessThan(surface)
    }
  })

  /*
   **칩은 카드 밖이다.** 목록을 좁히는 도구이고 카드는 그 결과를 담는다 (#439 판단).
   **그리고 #537 이후로는 제목 줄 뒤다** — 소스 순서로 `h1` < 칩 < `<Surface` 를 본다.
   */
  it('필터 칩이 제목 줄과 Surface 사이에 서고 lg 에서 숨는다', () => {
    const view = block(listView, 'EmergencyListView')
    const title = view.indexOf('<h1 className="text-title-1')
    const chips = view.indexOf('<EmergencyFilterChips')
    const surface = view.indexOf('<Surface ')

    expect(title).toBeGreaterThan(-1)
    expect(chips).toBeGreaterThan(title)
    expect(chips).toBeLessThan(surface)
    expect(view.slice(chips, surface)).toMatch(/className="lg:hidden"/)
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
    **#537 로 카드가 제목을 잃어 두 답이 다시 만났다** — `inset` 도 레벨도 기본값이라
    레벨은 명시적으로 `2` 를 넘겨 그 사실을 소스에 남긴다.
  */
  it('카드가 제목을 잃었으므로 상태 제목이 h2 다', () => {
    const view = block(listView, 'EmergencyListView')

    expect(view).toMatch(/<EmergencyBoardSection board=\{board\} headingLevel=\{2\} \/>/)

    // 짝의 반대쪽 — 그 카드가 실제로 제목을 갖지 않는다. 도로 넣으면 레벨 단언이 함께 깨진다
    expect(view).not.toMatch(/<Surface\b[\s\S]*?\btitle=/)
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
    **제목 줄이 두 열 위에 얹힌다.** `.rail-heading`(globals.css)이 `grid-column: 1 / -1` 을
    준다 — 이것이 없으면 제목이 우측 열에 남아 DOM 순서와 시각 순서가 어긋난다.
  */
  it('제목 줄이 rail-heading 으로 두 열 위에 선다', () => {
    const heading = view.indexOf('rail-heading')
    const aside = view.indexOf('<aside')
    const stack = view.indexOf('<SurfaceStack')

    expect(heading).toBeGreaterThan(-1)
    /* 소스 순서가 곧 DOM 순서다 — 제목 → 레일 → 목록 */
    expect(heading).toBeLessThan(aside)
    expect(aside).toBeLessThan(stack)
  })

  /*
    **스택 밖으로 나온 제목 줄이 스택이 주던 여백을 스스로 진다.** 바깥 `md:px-6` 이
    `SurfaceStack` 의 `md:p-6` 자리를, 안쪽 `INSET_CLASS.card` 가 카드 인셋을 쓴다.
    스택은 `md:pt-0` 으로 자기 위 여백을 내놓는다 — 둘 다 두면 768 에서 48 로 벌어진다.
  */
  it('제목 줄과 스택이 여백을 두 번 넣지 않는다', () => {
    expect(view).toMatch(/rail-heading[^"]*md:px-6/)
    // `list-column`(globals.css)이 우측 열에 자기 스크롤을 준다 (#553)
    expect(view).toMatch(/<SurfaceStack[^>]*className="list-column md:pt-0"/)
  })
})
