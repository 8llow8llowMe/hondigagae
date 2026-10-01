/**
 * 장소 찾기 지도 보기의 보기 토글 자리 — 이슈 #1121.
 *
 * **소스를 문자열로 읽는다.** `PlaceMapView` 는 카카오 SDK·위치 훅을 잡고 있어 node 환경에서
 * 렌더되지 않고, 지키려는 것도 렌더 결과가 아니라 **자리 계약**이다 — 1024 이상에서 토글이
 * 지도 우상단이 아니라 패널 머리 줄에 서고, 패널을 접어도 펼치기 버튼 옆에 남는다.
 * `place-map-search.test.ts` 와 같은 방식이다.
 *
 * **되돌리기 쉬운 자리라 잠근다.** 우상단 토글은 #412 가 목록 보기 토글과 픽셀 자리를 맞춘
 * 결과였다 — 그 주석만 읽고 "같은 자리여야 한다" 로 되돌리는 변경이 조용히 통과하면 안 된다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

const mapView = source('src/features/place/place-map-view.tsx')
const listPage = source('app/(main)/places/(list)/page.tsx')
const addPlaceView = source('src/features/plan/plan-add-place-view.tsx')

/** 지도 우상단 떠 있는 줄 — 좌측 패널 바깥 래퍼가 시작되기 전까지 */
const overlay = mapView.slice(
  mapView.indexOf('pointer-events-none absolute inset-x-0 top-5'),
  mapView.indexOf('absolute bottom-8 left-4'),
)
/** 패널 바깥 래퍼 — 펼치기 버튼과 접힌 토글이 여기 서고, 패널 본체(`map-panel-width`) 앞이다 */
const panelShell = mapView.slice(
  mapView.indexOf('absolute bottom-8 left-4'),
  mapView.indexOf('map-panel-width'),
)
/** 패널 본체 — 머리 줄 · 검색 · 필터 · 개수 · 목록 */
const panelBody = mapView.slice(mapView.indexOf('map-panel-width'), mapView.indexOf('<MapSheet'))

/** `<ViewToggle` 여는 태그 하나를 잘라 낸다 — 마크업 전체에 단언하면 다른 토글에 속는다 */
function toggleTag(scope: string): string {
  const start = scope.indexOf('<ViewToggle')
  expect(start).toBeGreaterThan(-1)
  return scope.slice(start, scope.indexOf('/>', start))
}

describe('보기 토글은 1024 이상에서 패널 머리 줄에 선다 (#1121)', () => {
  it('제목을 받아야 패널로 들어간다 — 토글 목적지 둘 + 제목', () => {
    expect(mapView).toContain('const toggleInPanel = showToggle && title !== undefined')
  })

  it('우상단 토글은 패널이 토글을 가지면 lg 에서 숨는다', () => {
    expect(toggleTag(overlay)).toContain("toggleInPanel && 'lg:hidden'")
  })

  it('우상단에는 내 위치가 그대로 남는다', () => {
    expect(overlay).toContain('<MapLocateButton')
  })

  it('패널 머리 줄은 제목 다음에 토글이고, 검색보다 위다', () => {
    const row = panelBody.indexOf('{toggleInPanel && (')
    const heading = panelBody.indexOf('<h2', row)
    const toggle = panelBody.indexOf('<ViewToggle', row)
    const search = panelBody.indexOf('<PlaceSearchField')

    expect(row).toBeGreaterThan(-1)
    expect(heading).toBeGreaterThan(row)
    expect(toggle).toBeGreaterThan(heading)
    expect(search).toBeGreaterThan(toggle)

    expect(panelBody.slice(heading, panelBody.indexOf('</h2>', heading))).toContain('{title}')
    expect(toggleTag(panelBody.slice(row))).toContain('current="map"')
  })

  /*
    머리 줄과 검색 줄은 한 덩어리의 머리다 — 사이에 선이 서면 제목이 따로 뜬 띠로 읽힌다.
    여는 태그 하나로 범위를 좁힌다: 바로 아래 검색 줄은 `border-b` 를 갖는다.
  */
  it('머리 줄에는 아래 선이 없다', () => {
    const row = panelBody.indexOf('{toggleInPanel && (')
    const open = panelBody.slice(row, panelBody.indexOf('>', panelBody.indexOf('<div', row)))

    expect(open).toContain('className=')
    expect(open).not.toContain('border-b')
  })
})

describe('패널을 접어도 토글이 남는다 (#1121)', () => {
  const expand = panelShell.indexOf('aria-label={messages.map.expandPanel}')
  const collapsed = panelShell.indexOf('{toggleInPanel && (')

  it('펼치기 버튼 다음, 패널 본체 바깥에 선다', () => {
    expect(expand).toBeGreaterThan(-1)
    expect(collapsed).toBeGreaterThan(expand)
    // 본체 안이면 패널과 함께 밀려나 접힌 동안 사라진다
    expect(panelBody).not.toContain('inert={panelOpen}')
  })

  /*
    열린 동안에는 머리 줄에 같은 토글이 있다. 둘 다 살아 있으면 Tab 이 같은 링크를 두 번
    지나고 보조기기에 같은 그룹이 둘 들린다.
  */
  it('열린 동안에는 inert 이고 보이지 않는다', () => {
    const wrapper = panelShell.slice(collapsed, panelShell.indexOf('<ViewToggle', collapsed))

    expect(wrapper).toContain('inert={panelOpen}')
    expect(wrapper).toContain("panelOpen && 'pointer-events-none opacity-0'")
    // 펼치기 버튼(44) + 간격 8
    expect(wrapper).toContain('left-13')
  })
})

describe('제목은 화면이 준다 (#1121)', () => {
  it('/places 지도 보기가 페이지 제목을 넘긴다', () => {
    const tag = listPage.slice(
      listPage.indexOf('<PlaceMapView'),
      listPage.indexOf('/>', listPage.indexOf('<PlaceMapView')),
    )

    expect(tag).toContain('title={messages.place.pageTitle}')
  })

  /* 담기 지도는 떠 있는 머리 카드가 제목을 갖는다 — 패널에 또 세우면 한 기둥에 두 번 선다 */
  it('담기 지도는 넘기지 않는다', () => {
    /*
      **지도 갈래 전체가 범위다.** 한 prop 앞에서 자르면 그 뒤에 붙인 `title=` 을 놓치고, 콜백
      prop 안에도 `/>` 가 있어 여는 태그의 끝을 문자열로 잡을 수 없다. 지도 갈래는 목록 갈래의
      `return (` 앞에서 끝난다. 이 범위에는 `title=` 이 하나도 없다 — 제목은 머리의 `h1` 이 그린다.
    */
    const start = addPlaceView.indexOf("if (view === 'map')")
    const branch = addPlaceView.slice(start, addPlaceView.indexOf('\n  return (', start))

    expect(branch).toContain('<PlaceMapView')
    expect(branch).toContain('head={')
    expect(branch).not.toMatch(/\btitle=/)
  })
})
