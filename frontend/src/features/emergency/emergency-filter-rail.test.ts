import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { EmergencyFilterRail } from '@/features/emergency/emergency-filter-rail'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

const COUNTS = {
  all: 12,
  byType: { ANIMAL_HOSPITAL: 7, ANIMAL_PHARMACY: 5 },
  open24: 3,
  openNow: 8,
}

function render(filters: FacilityFilters, radius = 10000) {
  return renderToStaticMarkup(
    createElement(EmergencyFilterRail, {
      filters,
      onFiltersChange: vi.fn(),
      radius,
      onRadiusChange: vi.fn(),
      counts: COUNTS,
      showCounts: true,
    }),
  )
}

describe('EmergencyFilterRail — 데스크톱 필터 레일 (#419)', () => {
  it('네 축을 모두 그린다 — 반경 · 유형 · 영업 조건', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS)

    expect(markup).toContain('시설 유형')
    expect(markup).toContain('영업 조건')
    expect(markup).toContain('10km')
  })

  /* `/places` 레일과 같은 규칙 — 걸린 필터가 없으면 누를 수 없는 버튼을 남기지 않는다 */
  it('걸린 조건이 없으면 초기화를 내지 않는다', () => {
    expect(render(DEFAULT_FACILITY_FILTERS)).not.toContain('초기화')
  })

  /* `openNowOnly` 는 기본 ON 이라 «걸린 조건» 이 아니다 (#654) — 유형으로 잰다 */
  it('조건이 걸리면 초기화가 나온다', () => {
    expect(render({ ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_PHARMACY' })).toContain('초기화')
  })

  /** 기본 ON 인 축을 **끈** 것도 되돌릴 것이 남은 상태다 */
  it('지금 진료중을 끄면 초기화가 나온다', () => {
    expect(render({ ...DEFAULT_FACILITY_FILTERS, openNowOnly: false })).toContain('초기화')
  })

  /*
    **반경은 초기화 대상이 아니다** — 필터가 아니라 조회 파라미터다. 넓혀 찾던 사용자가
    조건 하나를 끄려다 결과를 통째로 잃으면 안 된다 (`EmergencyBoardParams` 의 구분).
  */
  it('반경만 기본값과 달라도 초기화를 내지 않는다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS, 40000)

    expect(markup).toContain('40km')
    expect(markup).not.toContain('초기화')
  })

  /*
    **레일에는 검색 입력이 없지만 `초기화` 는 검색어까지 지운다** (#584). `dirty` 가
    검색어를 모르면 검색어만 걸린 상태에서 버튼이 사라져, 되돌릴 것이 남았는데 손잡이가 없다.
  */
  it('검색어만 걸려 있어도 초기화가 나온다', () => {
    expect(render({ ...DEFAULT_FACILITY_FILTERS, keyword: '한라' })).toContain('초기화')
  })

  /* 레일 인셋 규약(`.filter-rail`)을 타는 컨테이너여야 왼쪽 기준선 40 에 선다 (#386) */
  it('filter-rail 컨테이너를 쓴다', () => {
    expect(render(DEFAULT_FACILITY_FILTERS)).toContain('filter-rail')
  })
})

/*
  **레일의 축 순서도 뒤집혔다** (#654 E-3). 여기는 오래 반경이 첫 축이었는데
  (*"지도를 옮겨도 재조회하지 않으므로 반경이 «더 넓게 찾기» 의 유일한 손잡이"*, #535),
  그 말은 지금도 맞지만 **순서의 근거로는 약하다** — 반경을 넓히는 사람은 이미 결과를
  보고 부족하다고 판단한 사람이라 축을 찾아 내려갈 여유가 있다.

  모바일 칩 줄과 같은 순서여야 한다 (`EmergencyFilterChips`) — 두 표면이 다른 순서로
  같은 축을 늘어놓으면 폭을 바꿨을 때 사용자가 다시 배워야 한다.
*/
describe('EmergencyFilterRail — 축 순서 (#654 E-3)', () => {
  it('영업 조건 · 시설 유형 · 검색 반경 순이다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS)
    const positions = ['영업 조건', '시설 유형', '검색 반경'].map((label) => markup.indexOf(label))

    expect(positions.some((index) => index < 0)).toBe(false)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
  })

  it('영업 조건 안에서도 지금 진료중이 먼저다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS)

    expect(markup.indexOf('지금 진료중')).toBeLessThan(markup.indexOf('24시간'))
  })
})
