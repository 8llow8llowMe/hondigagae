/**
 * 장소 찾기 지도 보기의 검색 자리 — 이슈 #596.
 *
 * **소스를 문자열로 읽는다.** `PlaceMapView` 는 카카오 SDK·`useMap`·위치 훅을 한꺼번에
 * 잡고 있어 node 환경 렌더에 mock 이 여럿 필요하고, 여기서 지키려는 것은 렌더 결과가
 * 아니라 **자리 계약**이다: 무엇이 토글 왼쪽에 서고, 무엇이 `lg` 에서 갈리고, 어느 쪽이
 * `compact` 인가. `place-map-panel-slide.test.ts` 와 같은 방식이다.
 *
 * **#431 의 결정을 뒤집은 자리라 특히 잠근다.** 그때는 *"지도 갈래에는 두지 않는다"* 였고,
 * 근거 없이 그 상태로 되돌리는 변경이 조용히 통과하면 안 된다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

const mapView = source('src/features/place/place-map-view.tsx')
const listPage = source('app/(main)/places/(list)/page.tsx')
const addPlaceView = source('src/features/plan/plan-add-place-view.tsx')

/** 지도 위 떠 있는 줄 — 좌측 패널(`map-panel-width`)이 시작되기 전까지 */
const overlay = mapView.slice(
  mapView.indexOf('pointer-events-none absolute inset-x-0 top-5'),
  mapView.indexOf('map-panel-width'),
)
const panel = mapView.slice(mapView.indexOf('map-panel-width'))

describe('지도 보기의 검색 자리 (#596)', () => {
  /*
    1024 미만 전용 — 그 위는 좌측 패널이 같은 일을 한다. 둘 다 그리면 데스크톱 지도에
    검색창이 둘이 된다.
  */
  it('오버레이 검색은 보기 토글보다 앞이고 lg 에서 숨는다', () => {
    const search = overlay.indexOf('<PlaceSearchField')
    const toggle = overlay.indexOf('<ViewToggle')

    expect(search).toBeGreaterThan(-1)
    expect(toggle).toBeGreaterThan(search)

    const tag = overlay.slice(search, overlay.indexOf('/>', search))
    expect(tag).toContain('lg:hidden')
    // 375 에 225 밖에 없다(보기 전환 110, #1125) — 글자 제출 버튼이면 입력이 157 로 줄어 placeholder 가 잘린다
    expect(tag).toContain('compact')
    // 768 에서 538 로 벌어지지 않게 상한을 둔다
    expect(tag).toContain('max-w-md')
  })

  /* 패널 툴바 안쪽이 374 라 목록 갈래 모바일 검색(343)보다 넓다 — 줄일 이유가 없다 */
  it('패널 검색은 필터바보다 위이고 compact 가 아니다', () => {
    const search = panel.indexOf('<PlaceSearchField')
    const filterBar = panel.indexOf('<PlaceMapFilterBar')

    expect(search).toBeGreaterThan(-1)
    expect(filterBar).toBeGreaterThan(search)

    const tag = panel.slice(search, panel.indexOf('/>', search))
    expect(tag).not.toContain('compact')
  })

  /*
    #1289 — SDK 가 실패하면 축소판 폴백(검색 · 목록)을 그리지 않고 **목록 보기로 옮긴다.** 그 축소판에 검색을
    남겨 두던 이유(#596 — 필터 칩도 초기화도 없어 검색어를 지울 길이 없었다)는 목록 보기가 이미 해결한다.
  */
  it('SDK 실패는 목록 보기로 옮긴다 — 축소판 폴백을 그리지 않는다', () => {
    expect(mapView).toContain('useMapFailureFallback(failure, fallbackHref)')
    expect(mapView).toContain('if (failure !== null) return null')
    expect(mapView).not.toContain('place-keyword-fallback')
  })

  /*
    **자리들이 한 문서에 동시에 있다** — 오버레이(또는 머리 아래)와 패널은 CSS 로만 갈리고, 폴백은
    배타적이지만 같은 파일이다. 같은 `id` 가 둘이면 `htmlFor` 가 어느 입력을 가리키는지
    문서가 정하지 못하고, 보조기기가 라벨 없는 입력을 보게 된다.
  */
  it('세 자리의 입력 id 가 모두 다르다', () => {
    // `place-keyword-head` 는 떠 있는 머리 아래 자리다 (#1012)
    const ids = ['place-keyword-map', 'place-keyword-panel', 'place-keyword-head']

    for (const id of ids) expect(mapView).toContain(`id="${id}"`)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/*
  **`searchable` 은 화면이 켠다** — 기본은 끔이다.

  #596 때는 담기 화면(#370)이 **목록 갈래에도 검색이 없어서** 켜지 않았다 — 지도에만 켜면
  같은 화면의 두 보기가 다른 도구를 갖는다. #1012 가 두 갈래에 함께 들였으므로 이제 켠다.
  원칙(두 보기가 같은 도구를 갖는다)은 그대로라, 목록 갈래 쪽은 `plan-add-place-map.test.ts`
  가 함께 잠근다.
*/
describe('searchable 은 화면이 켠다', () => {
  it('기본값이 꺼짐이다', () => {
    expect(mapView).toMatch(/searchable = false/)
  })

  it('/places 목록 페이지가 켠다', () => {
    const tag = listPage.slice(
      listPage.indexOf('<PlaceMapView'),
      listPage.indexOf('/>', listPage.indexOf('<PlaceMapView')),
    )

    expect(tag).toContain('searchable')
  })

  it('담기 화면도 켠다 (#1012)', () => {
    const tag = addPlaceView.slice(
      addPlaceView.indexOf('<PlaceMapView'),
      addPlaceView.indexOf('head={', addPlaceView.indexOf('<PlaceMapView')),
    )

    expect(tag).toMatch(/\bsearchable\b/)
  })
})

/*
  **떠 있는 머리가 있으면 1024 미만 검색이 그 아래로 간다** — 이슈 #1012.

  토글 왼쪽 오버레이 자리는 담기 화면의 머리 카드(`end-32`) 밑이다. 거기 그리면 검색이
  **보이지 않는 채로 포커스를 받는다.** 그래서 머리가 있으면 오버레이 자리를 비우고, 머리와
  같은 기둥에 세운다.
*/
describe('머리가 있는 화면의 검색 자리 (#1012)', () => {
  const headColumn = mapView.slice(mapView.indexOf('{hasHead && (\n        <div'))

  it('오버레이 검색은 머리가 없을 때만 그린다', () => {
    expect(overlay).toContain('searchable && !hasHead && (')
  })

  it('머리 기둥이 패널 기둥(start-4)에 붙고 머리 다음에 검색이 선다', () => {
    expect(headColumn).toMatch(/absolute start-4 end-32 top-5 z-30[^"]*lg:end-auto lg:top-6/)

    const head = headColumn.indexOf('{head}')
    const search = headColumn.indexOf('<PlaceSearchField')
    expect(head).toBeGreaterThan(-1)
    expect(search).toBeGreaterThan(head)

    const tag = headColumn.slice(search, headColumn.indexOf('/>', search))
    // 패널 맨 위가 1024 이상을 맡는다 — 둘 다 그리면 데스크톱에 검색창이 둘이 된다
    expect(tag).toContain('lg:hidden')
    expect(tag).toContain('compact')
    expect(tag).toContain('id="place-keyword-head"')
    // 머리 카드와 폭을 맞춘다 — 한 기둥의 두 표면 오른쪽 끝이 어긋나지 않게
    expect(tag).not.toContain('max-w-md')
  })

  /*
    **키보드 순서가 화면 순서와 같아야 한다** (#1012 검토 · WCAG 2.4.3). 모바일에서 맨 위에
    보이는 머리·검색이 문서 맨 뒤에 있으면 토글 → 내 위치 → 시트 행 수십 개를 지나야 닿는다.
    `/places` 의 오버레이 검색이 토글보다 앞인 것과 같은 순서다. 시트가 머리에 닿지 않으므로
    (`sheetMaxTopInset`) 순서가 쌓임을 정하지 않는다.
  */
  it('머리 기둥은 우상단 컨트롤·시트보다 앞에 온다', () => {
    const column = mapView.indexOf('{hasHead && (\n        <div')

    expect(column).toBeGreaterThan(-1)
    expect(column).toBeLessThan(mapView.indexOf('<ViewToggle'))
    expect(column).toBeLessThan(mapView.indexOf('<MapSheet'))
  })

  it('null·false 도 머리 없음으로 가른다 — `head={조건 && …}` 가 빈 래퍼를 만들지 않게', () => {
    expect(mapView).toContain(
      'const hasHead = head !== undefined && head !== null && head !== false',
    )
  })
})
