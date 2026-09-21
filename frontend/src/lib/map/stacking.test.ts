import { describe, expect, it } from 'vitest'

import { MAP_LAYER_Z, markerZIndex } from '@/lib/map/stacking'

/**
 * 지도 오버레이의 쌓임 순서 — 이슈 [#671](https://github.com/8llow8llowMe/hondigagae/issues/671) A-1.
 *
 * **이 파일이 존재하는 이유가 A-1 그 자체다.** `map-canvas.tsx` 의 주석은 *"원이 통째로
 * 덮여 누를 수 없는 묶음이 된다"* 를 근거로 묶음을 일반 핀 위로 올려 놓고, **선택 핀 축에
 * 같은 논리를 적용하지 않았다.** 주석과 표현식이 서로 다른 말을 했고 8개월을 살아남았다.
 *
 * 값 하나하나가 아니라 **순서**를 단언한다 — 숫자는 바뀌어도 되지만 순서는 아니다.
 */
describe('markerZIndex', () => {
  it('묶음이 선택 핀 위에 선다 — 원을 누를 수 있어야 한다 (A-1)', () => {
    expect(markerZIndex({ isCluster: true, selected: false })).toBeGreaterThan(
      markerZIndex({ isCluster: false, selected: true }),
    )
  })

  it('선택 핀이 일반 핀 위에 선다 — 고른 것이 이름표째 읽혀야 한다', () => {
    expect(markerZIndex({ isCluster: false, selected: true })).toBeGreaterThan(
      markerZIndex({ isCluster: false, selected: false }),
    )
  })

  /**
   * 묶음은 여럿을 대표하므로 **묶음이라는 사실이 선택보다 앞선다.** 묶음 안에 고른 핀이
   * 섞여 있다고 해서 원이 아래로 내려가면 A-1 이 그대로 되돌아온다.
   */
  it('묶음은 그 안에 고른 핀이 있어도 맨 위다', () => {
    expect(markerZIndex({ isCluster: true, selected: true })).toBe(
      markerZIndex({ isCluster: true, selected: false }),
    )
  })

  it('선이 모든 마커 아래다 — 선이 이름표를 덮으면 글자가 잘린다', () => {
    const markers = [
      markerZIndex({ isCluster: false, selected: false }),
      markerZIndex({ isCluster: false, selected: true }),
      markerZIndex({ isCluster: true, selected: false }),
    ]

    for (const z of markers) expect(z).toBeGreaterThan(MAP_LAYER_Z.route)
  })
})
