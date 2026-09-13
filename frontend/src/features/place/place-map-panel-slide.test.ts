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

  it('패널이 항상 마운트되고 닫히면 이름 있는 클래스로 밀려난다', () => {
    expect(mapView).toContain('map-panel-width relative h-full transition-transform')
    expect(mapView).toMatch(/!panelOpen && 'map-panel-collapsed'/)
  })

  /*
    **`calc()` 는 arbitrary value 로 못 쓴다** — Tailwind 가 조용히 무시할 수 있어
    `eslint.config.mjs` 의 `no-restricted-syntax` 가 막는다. globals.css 의 이름 있는
    클래스가 정본이고, 미는 거리는 **패널 폭 + 컨테이너 왼쪽 여백(`left-4`)** 이다 —
    폭만큼만 밀면 오른쪽 끝 16px 이 지도 위에 걸친다.
  */
  it('미는 거리가 globals.css 에 있고 왼쪽 여백까지 포함한다', () => {
    expect(globals).toContain('.map-panel-collapsed')
    expect(globals).toMatch(/translateX\(calc\(-100% - 1rem\)\)/)
  })

  /*
    **닫힌 패널은 화면 밖에 있을 뿐 DOM 에 남아 있다.** `inert` 가 없으면 Tab 이 보이지
    않는 목록 수십 항목과 필터 컨트롤을 그대로 지나간다 — 슬라이드로 바꾸면서 새로 생긴
    위험이라 같이 막는다.
  */
  it('닫힌 패널은 inert 라 포커스가 새지 않는다', () => {
    expect(mapView).toContain('inert={!panelOpen}')
  })

  /*
    펼치기 버튼은 패널과 **형제**이고 자리가 고정이다 — 패널이 밀려나도 손잡이는 원래
    자리에 남아 접기 전후로 같은 것으로 읽힌다. 열려 있는 동안에는 패널 아래 깔리므로
    클릭과 탭 순서에서 함께 빠져야 한다.
  */
  it('펼치기 버튼은 열려 있는 동안 클릭도 탭도 받지 않는다', () => {
    expect(mapView).toMatch(/panelOpen && 'pointer-events-none opacity-0'/)
    expect(mapView).toContain('tabIndex={panelOpen ? -1 : undefined}')
  })

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
