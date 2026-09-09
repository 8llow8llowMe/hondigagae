import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmergencyFilterBar, RADIUS_OPTIONS } from '@/features/emergency/emergency-filter-bar'
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

  it('24시간을 켜면 결과가 적다는 사실을 알린다 — 백엔드 스키마가 명시한 안내다', () => {
    expect(render()).not.toContain(messages.emergency.open24Note)
    expect(render({ filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true } })).toContain(
      messages.emergency.open24Note,
    )
  })

  it('기본 조건이면 초기화를 두지 않는다', () => {
    expect(render()).not.toContain(messages.place.resetFilters)
  })

  it('조건이 걸려 있으면 초기화가 나온다', () => {
    const markup = render({ filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true } })

    expect(markup).toContain(messages.place.resetFilters)
  })

  it('반경은 초기화 대상이 아니다 — 필터가 아니라 조회 파라미터다', () => {
    const markup = render({ radius: MAX_RADIUS_METERS })

    expect(markup).not.toContain(messages.place.resetFilters)
  })

  it('반경 선택지는 넓히기 사다리와 상한을 따른다', () => {
    expect(RADIUS_OPTIONS).toEqual([10_000, 20_000, 40_000, MAX_RADIUS_METERS])
  })
})
