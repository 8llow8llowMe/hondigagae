import { describe, expect, it } from 'vitest'

import type { LatLng } from '@/lib/geo/coord'
import {
  cellSizeFor,
  clusterByGrid,
  clusterForLevel,
  type ClusterInput,
  clusterMarkerLabel,
  clusterMarkerText,
} from '@/lib/map/cluster'
import { metersPerPixel } from '@/lib/map/viewport'
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

  /*
    **셀 크기는 도(度)인데 겹침은 픽셀에서 일어난다** (#671 D-3).

    이전 표는 단계마다 고른 상수였고, 그 값이 화면에서 몇 px 로 보이는지는 아무도 재지
    않았다. 재 보면 **축소할수록 간격이 좁아진다** — 셀은 단계마다 3배씩 커지는데 픽셀당
    미터는 **2배씩** 커지므로, 두 단계마다 한 번씩 셀이 커지는 표로는 따라잡지 못한다.

    그래서 마커를 아무리 줄여도 겹치는 구간이 있었다. 묶음 원을 32px 로 줄인 것(#671 D-2)
    으로는 닿지 않는다 — **인접 셀의 중심 간격 자체가 32px 미만**이기 때문이다.

    기준은 원 지름(32)이 아니라 **44** 다. 44 는 DESIGN.md §7 의 최소 터치 영역이고,
    묶음이 `::before` 로 실제 갖는 히트박스 폭이다 (`globals.css` `.map-cluster::before`).
    두 묶음이 44 보다 가까우면 **보이는 원은 안 겹쳐도 누르는 자리가 겹친다.**
  */
  describe('화면 간격 (#671 D-3)', () => {
    const METERS_PER_LAT_DEGREE = 111_320

    /** 카카오 확대 단계의 최대(= 가장 축소). `viewport.ts` 가 같은 값을 비공개로 둔다 */
    const MAX_MAP_LEVEL = 14

    /*
      **경도축으로 잰다.** 격자는 도 단위로 정사각이지만 경도 1도는 위도 1도보다
      `cos(위도)` 만큼 짧아, 제주(위도 33.4°)에서는 가로가 세로의 0.835 배다.
      **먼저 무너지는 축이 가로**이므로 여기를 재면 두 축 모두 보장된다.
    */
    const METERS_PER_LNG_DEGREE = METERS_PER_LAT_DEGREE * Math.cos((33.4 * Math.PI) / 180)

    /** 인접한 두 셀의 중심 사이가 화면에서 몇 px 인가 */
    function cellGapPx(level: number): number {
      return (cellSizeFor(level) * METERS_PER_LNG_DEGREE) / metersPerPixel(level)
    }

    it('묶는 모든 단계에서 인접 묶음이 44px 보다 가까워지지 않는다', () => {
      for (let level = 5; level <= MAX_MAP_LEVEL; level += 1) {
        expect(cellGapPx(level), `level ${String(level)}`).toBeGreaterThanOrEqual(44)
      }
    })

    /*
      고치기 전 실측값이다. 표가 단계를 따라잡지 못하는 지점이 어디였는지 남긴다 —
      level 13 은 **10.9px** 로, 원(32) 하나도 들어가지 않는 간격이었다.
    */
    it('이전 표가 무너지던 단계들이 전부 올라왔다', () => {
      expect(cellGapPx(10)).toBeGreaterThanOrEqual(44) // 이전 29.0
      expect(cellGapPx(12)).toBeGreaterThanOrEqual(44) // 이전 21.8
      expect(cellGapPx(13)).toBeGreaterThanOrEqual(44) // 이전 10.9
    })

    /*
      **이미 44 를 넘던 단계는 건드리지 않는다.** 바닥을 보장하는 것이 목적이지 간격을
      44 로 통일하는 것이 아니다 — 통일하면 확대 구간에서 셀이 오히려 **작아져** 접히지
      않는 이름표 핀이 늘고, 이름표는 원과 달리 폭이 87px 까지 간다(실측). 고치려던 것보다
      나쁜 겹침을 새로 만든다.
    */
    it('이미 44px 을 넘던 단계는 그대로 둔다', () => {
      expect(cellSizeFor(5)).toBe(0.004)
      expect(cellSizeFor(6)).toBe(0.004)
      expect(cellSizeFor(7)).toBe(0.012)
      expect(cellSizeFor(9)).toBe(0.04)
    })
  })
})

/*
  **격자만으로는 마커가 안 떨어진다** (#671 D-3). 셀 간격을 44px 이상으로 올린 뒤에도
  `/emergency` 실측에서 묶음 중심이 17.0px · 27.2px · 29.2px 로 붙어 있었다 — 묶음이 찍히는
  자리가 셀 중앙이 아니라 **구성원 좌표의 평균**이라, 인접한 두 셀의 구성원이 각각 공유
  경계에 몰리면 두 평균점이 붙는다. 그래서 격자 다음에 거리로 한 번 더 합친다.
*/
describe('clusterForLevel', () => {
  const METERS_PER_LAT_DEGREE = 111_320
  const METERS_PER_LNG_DEGREE = METERS_PER_LAT_DEGREE * Math.cos((33.4 * Math.PI) / 180)

  function gapPx(a: LatLng, b: LatLng, level: number): number {
    const perPixel = metersPerPixel(level)

    return Math.hypot(
      ((a.lng - b.lng) * METERS_PER_LNG_DEGREE) / perPixel,
      ((a.lat - b.lat) * METERS_PER_LAT_DEGREE) / perPixel,
    )
  }

  /** 경계(`0.04` 의 배수)를 사이에 두고 양쪽에 붙은 두 좌표 — 격자는 가르고 화면은 붙는다 */
  const LEFT_OF_EDGE = { lat: 33.4, lng: 126.3999 }
  const RIGHT_OF_EDGE = { lat: 33.4, lng: 126.4001 }

  it('격자가 갈라 놓은 두 점도 화면에서 붙어 있으면 합친다', () => {
    const split = clusterByGrid(
      [
        input('a', LEFT_OF_EDGE.lat, LEFT_OF_EDGE.lng),
        input('b', RIGHT_OF_EDGE.lat, RIGHT_OF_EDGE.lng),
      ],
      cellSizeFor(9),
    )
    // 격자는 둘을 다른 칸으로 보낸다 — 이것이 실측에서 겹쳐 보이던 상태다
    expect(split).toHaveLength(2)

    const merged = clusterForLevel(
      [
        input('a', LEFT_OF_EDGE.lat, LEFT_OF_EDGE.lng),
        input('b', RIGHT_OF_EDGE.lat, RIGHT_OF_EDGE.lng),
      ],
      9,
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.items).toEqual(['a', 'b'])
  })

  it('어떤 두 묶음도 44px 보다 가까이 남지 않는다', () => {
    const scattered = Array.from({ length: 40 }, (_, index) =>
      input(`p${String(index)}`, 33.4 + index * 0.003, 126.3 + (index % 7) * 0.006),
    )

    for (const level of [5, 7, 9, 10, 12, 14]) {
      const groups = clusterForLevel(scattered, level)

      for (let i = 0; i < groups.length; i += 1) {
        for (let j = i + 1; j < groups.length; j += 1) {
          const a = groups[i]
          const b = groups[j]
          if (a === undefined || b === undefined) continue

          expect(gapPx(a.center, b.center, level), `level ${String(level)}`).toBeGreaterThanOrEqual(
            44,
          )
        }
      }
    }
  })

  /*
    둘을 합친 평균점이 세 번째 쪽으로 끌려가 **새로** 44px 안에 드는 경우다. 실측의
    `21`·`20`·`3` 이 그런 삼각형이었고, 한 번만 훑으면 마지막 하나가 남는다.
  */
  it('합치면서 중심이 옮겨져 새로 붙는 것까지 따라간다', () => {
    const chain = [input('a', 33.4, 126.4), input('b', 33.4, 126.4004), input('c', 33.4, 126.4008)]

    const groups = clusterForLevel(chain, 9)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.items).toEqual(['a', 'b', 'c'])
  })

  it('합쳐도 입력 순서를 보존한다 — 첫 항목이 거리순 첫 항목이어야 한다', () => {
    // 'first' 가 입력의 처음이지만 격자에서는 뒤쪽 칸에 들어간다
    const groups = clusterForLevel(
      [
        input('first', 33.4, 126.4001),
        input('second', 33.4, 126.3999),
        input('third', 33.4, 126.39995),
      ],
      9,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.items).toEqual(['first', 'second', 'third'])
  })

  it('순번 핀이 섞인 지도는 묶지 않는다 — level 이 null 이다', () => {
    const groups = clusterForLevel(
      [
        input('a', LEFT_OF_EDGE.lat, LEFT_OF_EDGE.lng),
        input('b', RIGHT_OF_EDGE.lat, RIGHT_OF_EDGE.lng),
      ],
      null,
    )

    expect(groups).toHaveLength(2)
  })

  it('충분히 확대한 단계에서는 거리로도 합치지 않는다', () => {
    const groups = clusterForLevel(
      [
        input('a', LEFT_OF_EDGE.lat, LEFT_OF_EDGE.lng),
        input('b', RIGHT_OF_EDGE.lat, RIGHT_OF_EDGE.lng),
      ],
      4,
    )

    expect(groups).toHaveLength(2)
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
