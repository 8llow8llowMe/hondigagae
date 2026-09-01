import { describe, expect, it } from 'vitest'

import { cellSizeFor, clusterByGrid, type ClusterInput } from '@/lib/map/cluster'

function input(id: string, lat: number, lng: number): ClusterInput<string> {
  return { item: id, coord: { lat, lng } }
}

describe('cellSizeFor', () => {
  it('충분히 확대하면 묶지 않는다 — 개별 핀이 정답이다', () => {
    expect(cellSizeFor(1)).toBe(0)
    expect(cellSizeFor(4)).toBe(0)
  })

  it('축소할수록 셀이 커진다', () => {
    expect(cellSizeFor(6)).toBeLessThan(cellSizeFor(8))
    expect(cellSizeFor(8)).toBeLessThan(cellSizeFor(10))
    expect(cellSizeFor(10)).toBeLessThan(cellSizeFor(12))
  })
})

describe('clusterByGrid', () => {
  it('셀 크기가 0 이면 전부 개별 핀이다', () => {
    const groups = clusterByGrid([input('a', 33.4, 126.2), input('b', 33.4001, 126.2001)], 0)

    expect(groups).toHaveLength(2)
    expect(groups.every((group) => group.items.length === 1)).toBe(true)
  })

  it('같은 셀에 든 좌표를 하나로 묶는다', () => {
    const groups = clusterByGrid(
      [input('a', 33.4, 126.2), input('b', 33.401, 126.201), input('c', 33.5, 126.3)],
      0.01,
    )

    expect(groups).toHaveLength(2)
    expect(groups[0]?.items).toEqual(['a', 'b'])
    expect(groups[1]?.items).toEqual(['c'])
  })

  it('묶음 중심은 셀 중앙이 아니라 실제 좌표의 평균이다 — 바다 한가운데를 피한다', () => {
    const groups = clusterByGrid([input('a', 33.4, 126.2), input('b', 33.402, 126.204)], 0.01)

    expect(groups[0]?.center.lat).toBeCloseTo(33.401, 6)
    expect(groups[0]?.center.lng).toBeCloseTo(126.202, 6)
  })

  it('입력 순서를 보존한다 — 서버가 준 거리순이 목록과 갈리면 안 된다', () => {
    const groups = clusterByGrid(
      [input('first', 33.5, 126.3), input('second', 33.4, 126.2), input('third', 33.4001, 126.2)],
      0.01,
    )

    expect(groups[0]?.items).toEqual(['first'])
    expect(groups[1]?.items).toEqual(['second', 'third'])
  })

  it('같은 셀은 같은 key 다 — 지도를 흔들어도 React key 가 유지된다', () => {
    const once = clusterByGrid([input('a', 33.4, 126.2)], 0.01)
    const twice = clusterByGrid([input('a', 33.4, 126.2), input('b', 33.4005, 126.2005)], 0.01)

    expect(once[0]?.key).toBe(twice[0]?.key)
  })

  it('빈 입력은 빈 결과다', () => {
    expect(clusterByGrid([], 0.01)).toEqual([])
  })
})
