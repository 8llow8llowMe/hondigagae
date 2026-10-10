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

  /*
    **기준점 마커는 모든 장소 핀 아래다** (#1223). 누를 수 없는 표시라, 겹치면 누를 수 있는 핀이
    이겨야 한다. 선보다는 위다 — 선이 이름표를 덮으면 글자가 잘린다.
  */
  it('기준점 마커는 선 위, 모든 장소 핀 아래다', () => {
    expect(MAP_LAYER_Z.focus).toBeGreaterThan(MAP_LAYER_Z.route)
    expect(MAP_LAYER_Z.focus).toBeLessThan(markerZIndex({ isCluster: false, selected: false }))
  })
})

/*
  시설 층 (#1286 D2-4) — **같은 층 안에서 사각(시설)이 원(장소) 아래다.** `/places` 의 주인공은 장소다.
  고른 것은 모양과 무관하게 일반 핀 위이고, 묶음은 두 모양 모두 고른 핀 위다(#671 A-1).
*/
describe('markerZIndex — 사각(시설) 층', () => {
  const z = (isCluster: boolean, selected: boolean, shape: 'circle' | 'square') =>
    markerZIndex({ isCluster, selected, shape })

  it('cluster > squareCluster > selectedPin > pin > squarePin > focus > route', () => {
    const order = [
      z(true, false, 'circle'),
      z(true, false, 'square'),
      z(false, true, 'circle'),
      z(false, false, 'circle'),
      z(false, false, 'square'),
      MAP_LAYER_Z.focus,
      MAP_LAYER_Z.route,
    ]

    for (let index = 1; index < order.length; index += 1) {
      expect(order[index - 1]).toBeGreaterThan(order[index] as number)
    }
  })

  it('고른 사각은 모양과 무관하게 고른 핀 층이다', () => {
    expect(z(false, true, 'square')).toBe(z(false, true, 'circle'))
    expect(z(false, true, 'square')).toBe(MAP_LAYER_Z.selectedPin)
  })

  it('사각 묶음은 그 안에 고른 핀이 있어도 묶음 층이다', () => {
    expect(z(true, true, 'square')).toBe(MAP_LAYER_Z.squareCluster)
  })

  it('모양을 주지 않으면 원이다 — 시설 층 없는 지도는 예전 순서 그대로', () => {
    expect(markerZIndex({ isCluster: false, selected: false })).toBe(MAP_LAYER_Z.pin)
    expect(markerZIndex({ isCluster: true, selected: false })).toBe(MAP_LAYER_Z.cluster)
  })
})
