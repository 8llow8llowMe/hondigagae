import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'

/**
 * 마커 배선이 **한 통로로만 나가는가** — 이슈
 * [#671](https://github.com/8llow8llowMe/hondigagae/issues/671) F-5.
 *
 * ### 무엇이 안 잠겨 있었나
 *
 * 묶음 마커의 계약은 "**`textContent` = 숫자 / `aria-label` = 전체 문구**" 인데, 그 둘을
 * 바꿔 꽂아도 전부 초록이었다. 순수 함수(`clusterMarkerText` · `clusterMarkerLabel`)는
 * `lib/map/cluster.test.ts` 가 잠갔지만 **DOM 배선은 아무도 보지 않았다** — `clusterElement`
 * 가 `map-canvas.tsx` 안에서 따로 조립하고 있었고, 이 저장소의 vitest 는
 * `environment: 'node'` 라 `document` 가 없어 그 결과를 렌더할 수 없다
 * (`docs/testing-guide.md` §1).
 *
 * ### 왜 소스를 읽나
 *
 * **jsdom 을 들이지 않는다.** 이 항목 하나를 위해 환경을 바꾸는 값이 너무 크다
 * (`vitest.config.mts` 가 `environment: 'node'` · `include: src/&#42;&#42;/&#42;.test.ts`).
 * 대신 배선을 **`clusterContent` → `markerElement` 한 통로로 좁혀** 두고, 그 좁힘이
 * 유지되는지만 소스로 확인한다 — `map-canvas-consumers.test.ts` 가 쓰는 것과 같은 수단이다.
 *
 * 통로가 하나면 계약 자체는 `pin-content.test.ts` 가 node 에서 잠근다. 여기서 막는 것은
 * **"묶음이 그 통로를 안 거치는 것"** 하나다.
 */

const SOURCE = readSourceWithoutComments('src/features/map/map-canvas.tsx')

function occurrences(needle: string): number {
  return SOURCE.split(needle).length - 1
}

describe('map-canvas.tsx — 마커를 만드는 통로는 하나다', () => {
  /**
   * 둘이다: 요소 자체(`content.tag`)와 이름표 `span`. **세 번째가 생기면 그것이 곧
   * 두 번째 조립 경로**이고, `pin-content.test.ts` 가 보지 못하는 자리가 다시 생긴다.
   */
  it('document.createElement 는 두 군데뿐이다 — 요소 하나와 이름표 span', () => {
    expect(occurrences('document.createElement(')).toBe(2)
  })

  it('태그 이름을 직접 적는 자리는 span 뿐이다 — 요소 태그는 PinContent 가 정한다', () => {
    expect(SOURCE).toContain("document.createElement('span')")
    expect(SOURCE).not.toContain("document.createElement('button')")
    expect(SOURCE).not.toContain("document.createElement('div')")
  })
})

describe('map-canvas.tsx — 묶음의 판단이 이 파일에 남아 있지 않다', () => {
  /**
   * **이것이 F-5 가 지적한 결함 그 자체다.** `clusterElement` 가 `clusterMarkerText` 를
   * `textContent` 에, `clusterMarkerLabel` 을 `aria-label` 에 직접 꽂고 있었다. 이 파일이
   * 두 함수를 다시 부르기 시작하면 배선이 또 여기로 새어 나온 것이다.
   */
  it('clusterMarkerText / clusterMarkerLabel 을 직접 부르지 않는다', () => {
    expect(SOURCE).not.toContain('clusterMarkerText')
    expect(SOURCE).not.toContain('clusterMarkerLabel')
  })

  it('클래스 이름을 직접 적지 않는다 — map-cluster 는 clusterContent 가 정한다', () => {
    expect(SOURCE).not.toContain('map-cluster')
  })

  it('clusterContent 를 거쳐 서술자를 얻는다', () => {
    expect(SOURCE).toContain('clusterContent(')
  })

  /**
   * `aria-label` · `aria-pressed` · `role` 을 꽂는 자리도 applier 하나뿐이어야 한다.
   * 묶음 쪽에서 따로 `setAttribute` 를 시작하면 두 채널이 다시 갈린다.
   */
  it('aria-label 을 꽂는 자리가 하나뿐이다', () => {
    expect(occurrences("setAttribute('aria-label'")).toBe(1)
  })
})
