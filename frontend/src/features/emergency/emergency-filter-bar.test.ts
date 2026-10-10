import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyFilterBar } from '@/features/emergency/emergency-filter-bar'
import { open24Note } from '@/features/emergency/facility-filters'
import { MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { facility, pharmacy } from '@/test/fixtures/emergency'
import { DEFAULT_FACILITY_FILTERS } from '@/types/emergency'

function render(overrides: Partial<Parameters<typeof EmergencyFilterBar>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(EmergencyFilterBar, {
      facilities: [facility(), pharmacy()],
      filters: DEFAULT_FACILITY_FILTERS,
      onFiltersChange: () => undefined,
      radius: 10_000,
      onRadiusChange: () => undefined,
      showCounts: true,
      ...overrides,
    }),
  )
}

describe('EmergencyFilterBar', () => {
  it('개수는 넘긴 배열에서 센다 — 지도 화면에서는 "이 지역" 이 기준이다', () => {
    // 병원 1 · 약국 1 = 전체 2
    const markup = render()

    expect(markup).toContain(`${messages.emergency.typeAll} 2`)
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_HOSPITAL} 1`)
    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 1`)
  })

  it('개수가 0 인 칩도 그린다 — 그리지 않으면 그 유형으로 갈 방법이 없다', () => {
    const markup = render({ facilities: [facility()] })

    expect(markup).toContain(`${messages.emergency.typeByCode.ANIMAL_PHARMACY} 0`)
  })

  it('잘린 목록이면 숫자를 뺀다 — 틀린 개수는 없는 개수보다 나쁘다', () => {
    const markup = render({ showCounts: false })

    expect(markup).toContain(messages.emergency.typeAll)
    expect(markup).not.toContain(`${messages.emergency.typeAll} 2`)
  })

  it('반경을 현재 값으로 라벨에 쓴다', () => {
    const markup = render({ radius: 20_000 })

    expect(markup).toContain(
      messages.emergency.radiusLabel.replace('{radius}', formatDistance(20_000)),
    )
  })

  /*
    **여기만 켰을 때 뜬다** (#654). 목록 갈래는 이 줄을 늘 세우지만 지도 툴바는 375 시트
    위에 얹혀 세로가 없다 — 캡션 한 줄이 전화 버튼을 화면 밖으로 미는 일이 실제로 있었다.
  */
  it('24시간을 켜면 데이터 한계를 개수와 함께 알린다 — 백엔드 스키마가 명시한 안내다', () => {
    expect(render()).not.toContain('24시간 진료가 확인된 곳')
    expect(render({ filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true } })).toContain(
      open24Note(1, true),
    )
  })

  it('기본 조건이면 초기화를 두지 않는다', () => {
    expect(render()).not.toContain(messages.place.resetFilters)
  })

  /* `openNowOnly` 는 기본 ON 이라 «걸린 조건» 이 아니다 (#654) — 유형으로 잰다 */
  it('조건이 걸려 있으면 초기화가 나온다', () => {
    const markup = render({ filters: { ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_PHARMACY' } })

    expect(markup).toContain(messages.place.resetFilters)
  })

  /** 기본 ON 인 축을 **끈** 것도 되돌릴 것이 남은 상태다 */
  it('지금 진료중을 끄면 초기화가 나온다', () => {
    const markup = render({ filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: false } })

    expect(markup).toContain(messages.place.resetFilters)
  })

  /*
    **지도 갈래에는 검색 입력이 없다** (#584). 목록에서 좁혀 온 검색어를 푸는 손잡이가
    이 `초기화` 하나뿐이라, `dirty` 가 검색어를 모르면 그 하나마저 사라진다.
  */
  it('검색어만 걸려 있어도 초기화가 나온다', () => {
    const markup = render({ filters: { ...DEFAULT_FACILITY_FILTERS, keyword: '한라' } })

    expect(markup).toContain(messages.place.resetFilters)
  })

  it('반경은 초기화 대상이 아니다 — 필터가 아니라 조회 파라미터다', () => {
    const markup = render({ radius: MAX_RADIUS_METERS })

    expect(markup).not.toContain(messages.place.resetFilters)
  })
})

/*
  #883 — 두 줄이 한 줄이 됐다. 375 실화면에서 1행이 감겨 **세 줄 약 150px** 을 먹었고,
  그만큼이 시트 최소 단계의 본문에서 빠졌다.

  **마크업 전체에 클래스를 단언하지 않는다** — 어느 칩의 것인지 말하지 못해 false-green 이
  되기 쉽다. 스크롤러의 여는 태그와 첫 칩의 여는 태그로 범위를 좁힌다.
*/
describe('EmergencyFilterBar — 한 줄 가로 스크롤 (#883)', () => {
  /** `overflow-x-auto` 를 가진 요소의 여는 태그 */
  function railTag(markup: string) {
    const at = markup.indexOf('overflow-x-auto')
    const open = markup.lastIndexOf('<div', at)

    return markup.slice(open, markup.indexOf('>', at) + 1)
  }

  it('스크롤러가 하나뿐이다 — 축이 두 줄로 갈리지 않는다', () => {
    const markup = render()

    expect(markup.match(/overflow-x-auto/g)).toHaveLength(1)
    // 감겨서 줄이 늘어나는 갈래가 남아 있으면 375 에서 다시 세 줄이 된다
    expect(markup).not.toContain('flex-wrap')
  })

  it('두 축이 같은 스크롤러 안에 든다 — 이름은 묶음이 계속 갖는다', () => {
    const markup = render()
    const rail = markup.indexOf(railTag(markup))

    expect(markup.indexOf('role="group"')).toBeGreaterThan(rail)
    expect(markup.indexOf('role="radiogroup"')).toBeGreaterThan(rail)
    expect(markup).toContain(`aria-label="${messages.emergency.narrowGroupLabel}"`)
    expect(markup).toContain(`aria-label="${messages.emergency.typeGroupLabel}"`)
  })

  /** 목록 갈래(`EmergencyFilterChips`)가 두 줄로 두는 순서를 한 줄로 편 것이다 (#654 E-3) */
  it('순서가 목록 갈래와 같다 — 진료중 · 24시간 · 유형 · 반경', () => {
    const markup = render()
    const at = (text: string) => markup.indexOf(text)

    expect(at(messages.emergency.openNow)).toBeLessThan(at(messages.emergency.open24))
    expect(at(messages.emergency.open24)).toBeLessThan(at(messages.emergency.typeAll))
    expect(at(messages.emergency.typeAll)).toBeLessThan(
      at(messages.emergency.radiusLabel.replace('{radius}', formatDistance(10_000))),
    )
  })

  /*
    44 하한은 이제 **지도 위 타깃에만** 있다 (`DESIGN.md` §7, #883). 지도 화면의 칩은
    모바일 36 이고 768 이상에서 44 로 돌아간다 — 폭이 남는 자리에서까지 작아지면 같은
    컨트롤이 화면마다 다른 크기가 된다.
  */
  it('칩이 모바일 36 이고 768 이상에서 44 다', () => {
    const markup = render()
    const open = markup.indexOf('<button')
    const chipTag = markup.slice(open, markup.indexOf('>', open) + 1)

    expect(chipTag).toContain('h-9')
    expect(chipTag).toContain('md:h-11')
  })
})
