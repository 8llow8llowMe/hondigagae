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
const fallback = mapView.slice(
  mapView.indexOf('if (failure !== null)'),
  mapView.indexOf('const countLine'),
)

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
    // 375 에 245 밖에 없다 — 글자 버튼이면 입력이 177 로 줄어 placeholder 가 잘린다
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
    **폴백에는 필터 칩도 `초기화` 도 없다** (`onResetFilters` 가 no-op 다). 검색을 빼면
    `?keyword=` 를 달고 들어온 사용자가 그것을 지울 길이 화면에서 사라진다.
  */
  it('SDK 실패 폴백에도 검색이 남는다', () => {
    expect(fallback).toContain('<PlaceSearchField')

    const tag = fallback.slice(
      fallback.indexOf('<PlaceSearchField'),
      fallback.indexOf('/>', fallback.indexOf('<PlaceSearchField')),
    )
    // 카드 없는 페이지라 위 안내 줄·아래 목록과 같은 축이다
    expect(tag).toContain('INSET_CLASS.main')
  })

  /* 0건이면 무엇으로 찾았는지 되돌려 준다 — 목록 갈래가 같은 prop 을 넘긴다 */
  it('폴백 목록이 keyword 를 받아 0건 문구에 되돌려 준다', () => {
    expect(fallback).toContain('keyword={filters.keyword}')
  })

  /*
    **세 자리가 한 문서에 동시에 있다** — 오버레이와 패널은 CSS 로만 갈리고, 폴백은
    배타적이지만 같은 파일이다. 같은 `id` 가 둘이면 `htmlFor` 가 어느 입력을 가리키는지
    문서가 정하지 못하고, 보조기기가 라벨 없는 입력을 보게 된다.
  */
  it('세 자리의 입력 id 가 모두 다르다', () => {
    const ids = ['place-keyword-map', 'place-keyword-panel', 'place-keyword-fallback']

    for (const id of ids) expect(mapView).toContain(`id="${id}"`)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/*
  **`searchable` 은 화면이 켠다** — 기본은 끔이다.

  담기 화면(#370)은 `PlaceMapView` 를 같이 쓰지만 **목록 갈래에도 검색이 없다.** 지도에만
  켜면 같은 화면의 두 보기가 다른 도구를 갖는다 — 그 화면에 검색을 들일지는 별개 판단이라
  이 이슈에서 슬쩍 결정하지 않는다.
*/
describe('searchable 은 /places 만 켠다', () => {
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

  it('담기 화면은 켜지 않는다', () => {
    const tag = addPlaceView.slice(
      addPlaceView.indexOf('<PlaceMapView'),
      addPlaceView.indexOf('/>', addPlaceView.indexOf('<PlaceMapView')),
    )

    expect(tag).not.toContain('searchable')
  })
})
