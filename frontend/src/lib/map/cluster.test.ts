import { describe, expect, it } from 'vitest'

import {
  cellSizeFor,
  clusterByGrid,
  type ClusterInput,
  clusterMarkerLabel,
  clusterMarkerText,
} from '@/lib/map/cluster'
import { messages } from '@/lib/messages'

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

describe('clusterMarkerText', () => {
  it('숫자만 쓴다 — 원 안에 "이 지역 …곳" 이 들어가면 원이 알약으로 돌아간다', () => {
    expect(clusterMarkerText(3)).toBe('3')
    expect(clusterMarkerText(42)).toBe('42')
  })

  it('두 자리까지 그대로 쓴다 — 접기 직전이 99 다', () => {
    expect(clusterMarkerText(98)).toBe('98')
    expect(clusterMarkerText(99)).toBe('99')
  })

  /**
   * **상한이 `999` 에서 `99` 로 내려왔다** (#671 D-1). 이전 근거는 "네 글자가 안쪽 30px 에
   * 들어간다" 였는데 30px 은 정사각 패딩 박스라 원에 쓸 수 없는 자였다. 글자가 쓸 수 있는
   * 폭은 현(弦) 28.69px 이고 네 글자 실측은 29.5px — 넘친다.
   */
  it('세 자리부터 접는다 — 원이 늘어나느니 접는다', () => {
    expect(clusterMarkerText(100)).toBe('99+')
    expect(clusterMarkerText(135)).toBe('99+')
    expect(clusterMarkerText(1000)).toBe('99+')
    expect(clusterMarkerText(12345)).toBe('99+')
  })

  it('어떤 개수든 세 글자를 넘지 않는다 — 원이 늘어나는 유일한 경로를 막는다', () => {
    for (const count of [2, 9, 10, 99, 100, 135, 999, 1000, 99999]) {
      expect(clusterMarkerText(count).length).toBeLessThanOrEqual(3)
    }
  })

  it('망가진 입력에도 글자를 만든다 — 마커가 빈 원으로 뜨지 않는다', () => {
    expect(clusterMarkerText(Number.NaN)).toBe('0')
    expect(clusterMarkerText(-5)).toBe('0')
    expect(clusterMarkerText(4.7)).toBe('4')
  })
})

describe('clusterMarkerLabel', () => {
  it('접히지 않은 개수는 그대로 말한다', () => {
    expect(clusterMarkerLabel(42)).toBe('이 지역 42곳')
    expect(clusterMarkerLabel(99)).toBe('이 지역 99곳')
  })

  /*
    **WCAG 2.5.3 (Label in Name)** — 원에 보이는 글자가 접근성 이름 안에 있어야 한다.
    상한을 세 글자로 내리며 접히는 묶음이 흔해졌으므로(#671 D-1) 여기가 갈리면
    음성 입력 사용자가 화면에서 읽은 대로 부를 수 없다.
  */
  it('접힌 묶음은 이름도 접힌 글자를 쓴다 — 보이는 것과 갈리지 않는다', () => {
    expect(clusterMarkerLabel(100)).toBe('이 지역 99+곳')
    expect(clusterMarkerLabel(135)).toBe('이 지역 99+곳')
    expect(clusterMarkerLabel(1200)).toBe('이 지역 99+곳')
  })

  /* 구조 불변식 — 경계 밖까지 훑어 둘이 갈릴 자리가 없다는 것을 잠근다 */
  it('어떤 개수에서도 이름이 보이는 글자를 담는다', () => {
    for (const count of [0, 1, 9, 42, 98, 99, 100, 101, 999, 1000, 12345]) {
      expect(clusterMarkerLabel(count)).toContain(clusterMarkerText(count))
    }
  })

  it('문구는 messages 정본에서 온다', () => {
    expect(clusterMarkerLabel(7)).toBe(messages.map.clusterCount.replace('{n}', '7'))
  })
})
