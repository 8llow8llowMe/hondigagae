/**
 * 지도 좌측 패널 여닫기 — 이슈 #531.
 *
 * **소스를 문자열로 읽는다.** `PlaceMapView` 는 카카오 SDK·`useMap`·위치 훅을 한꺼번에
 * 잡고 있어 node 환경 렌더에 mock 이 여럿 필요한데, 여기서 지키려는 것은 렌더 결과가
 * 아니라 **구조 계약**이다: 닫혀도 패널이 마운트된 채 남는가, 그때 포커스가 새지 않는가.
 * `emergency-list-view.test.ts` · `filter-rail-inset.test.ts` 가 쓰는 방식과 같다.
 *
 * **브라우저 실측으로 대신할 수 없었다.** 이 검사를 쓴 환경에서는 카카오 SDK 스크립트가
 * 막혀 지도 갈래가 **SDK 실패 폴백**으로 떨어지고, 그 갈래에는 데스크톱 패널이 아예
 * 마운트되지 않는다(`mapFallback: true` 실측). 실측이 닿지 않는 자리라 계약을 소스에
 * 박아 둔다 — 회귀가 조용히 지나가는 것을 막는 것이 목적이다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

const mapView = source('src/features/place/place-map-view.tsx')
const globals = source('app/globals.css')

describe('패널은 갈아끼우지 않고 슬라이드한다 (#531)', () => {
  /*
    **예전에는 `panelOpen ? <패널> : <펼치기 버튼>` 이었다.** 열림과 닫힘이 서로 다른
    DOM 이라 트랜지션을 걸 대상이 없었고, 400px 패널이 한 프레임에 나타나고 사라졌다.
  */
  it('열림/닫힘이 서로 다른 DOM 으로 교체되지 않는다', () => {
    // 삼항으로 패널 전체를 갈아끼우던 모양이 돌아오면 걸린다
    expect(mapView).not.toMatch(/\{panelOpen \?[\s\S]{0,80}<div className="relative h-full">/)
  })

  /*
    #1232 — 래퍼째 **자기 폭만큼** 민다. 예전에는 왼쪽 여백 16 · 밖으로 튀어나온 접기 탭 24 · 그림자
    번짐 16 을 더해 미느라 `calc()` 클래스(`.map-panel-collapsed`)가 필요했는데, 도킹하면서 셋 다 없어졌다.
  */
  it('패널이 항상 마운트되고 닫히면 래퍼째 자기 폭만큼 밀려난다', () => {
    expect(mapView).toContain(
      "'absolute inset-y-0 left-0 z-30 hidden transition-transform lg:block'",
    )
    expect(mapView).toContain("!panelOpen && '-translate-x-full'")
    expect(globals).not.toContain('.map-panel-collapsed')
  })

  /*
    **닫힌 패널은 화면 밖에 있을 뿐 DOM 에 남아 있다.** `inert` 가 없으면 Tab 이 보이지
    않는 목록 수십 항목과 필터 컨트롤을 그대로 지나간다 — 슬라이드로 바꾸면서 새로 생긴
    위험이라 같이 막는다.
  */
  it('닫힌 패널은 inert 라 포커스가 새지 않는다', () => {
    expect(mapView).toContain('inert={!panelOpen}')
  })
})

/*
  #1232 D3 — 손잡이 하나. "패널 밖 오른쪽 위 접기 탭" 과 "접힌 뒤 좌상단 펼치기 버튼" 이 따로 놀아 손이
  두 군데로 갔다. 손잡이는 래퍼의 오른쪽 끝(`left-full`) 세로 중앙이라 스택 폭을 따라 400 · 800 · 0 에 선다.
*/
describe('접기 · 펼치기 손잡이는 하나다 (#1232)', () => {
  it('접기 버튼과 펼치기 버튼이 따로 있지 않다 — 한 버튼이 이름만 바꾼다', () => {
    expect(mapView.match(/messages\.map\.expandPanel/g)).toHaveLength(2)
    expect(mapView).toContain(
      'aria-label={panelOpen ? messages.map.collapsePanel : messages.map.expandPanel}',
    )
    expect(mapView).toContain('onClick={() => setPanelOpen((open) => !open)}')
  })

  it('스택 오른쪽 끝 세로 중앙에 서고 스택을 가리킨다', () => {
    expect(mapView).toContain('absolute top-1/2 left-full')
    expect(mapView).toContain('aria-expanded={panelOpen}')
    expect(mapView).toContain('aria-controls={stackId}')
    expect(mapView).toContain('id={stackId}')
  })

  /*
    손잡이는 스택의 **형제**여야 한다 — 스택 안에 두면 접힌 동안 `inert` 에 같이 걸려 펼칠 길이 없다.
    소스 순서로 확인한다: 스택이 닫힌 뒤(`</div>`)에 손잡이가 온다.
  */
  it('손잡이는 inert 스택 밖이다', () => {
    const stack = mapView.indexOf('id={stackId}')
    const handle = mapView.indexOf('aria-controls={stackId}')
    expect(stack).toBeGreaterThan(-1)
    expect(handle).toBeGreaterThan(stack)
    /*
      **스택 `div` 가 손잡이 앞에서 닫혀야 한다** — `inert=` 개수만 세면 손잡이를 스택 안(닫는 태그 앞)으로
      옮겨도 통과한다(리뷰 지적). 스택 여는 `<div` 부터 손잡이까지 여닫는 태그 수가 같으면 닫힌 뒤다.
    */
    const between = mapView.slice(mapView.lastIndexOf('<div', stack), handle)
    // 스스로 닫는 `<div … />`(아일랜드 로고 띠, #1287)는 짝 태그가 없다 — 여닫는 수에서 뺀다
    const selfClosing = between.match(/<div\b[^>]*\/>/g)?.length ?? 0
    expect((between.match(/<div\b/g)?.length ?? 0) - selfClosing).toBe(
      between.match(/<\/div>/g)?.length,
    )
  })

  /* DESIGN.md 44px 하한 — 보이는 탭은 24 지만 누르는 자리는 `::before` 로 넓힌다 */
  it('누르는 자리가 44 이상이다', () => {
    expect(mapView).toContain('h-12 w-6')
    expect(mapView).toContain('before:w-11')
  })
})

describe('감속 설정 (#531)', () => {
  /*
    **`prefers-reduced-motion` 을 여기서 다시 적지 않는다.** `app/globals.css` 의 매체질의가
    모든 요소의 `transition-duration` 을 0.01ms 로 덮는다 — 컴포넌트마다 `motion-reduce:`
    를 적으면 규칙이 두 군데가 되고, 한 곳만 고치는 드리프트가 생긴다.
  */
  it('감속 설정은 전역 규칙이 잡는다 — 컴포넌트가 따로 적지 않는다', () => {
    expect(mapView).not.toContain('motion-reduce:')
    expect(globals).toContain('prefers-reduced-motion')
    expect(globals).toMatch(/transition-duration: 0\.01ms !important/)
  })
})
