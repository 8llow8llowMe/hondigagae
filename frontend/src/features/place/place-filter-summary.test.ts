import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceFilterSummary } from '@/features/place/place-filter-summary'
import { messages } from '@/lib/messages'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

function render(filters: PlaceFilters) {
  return renderToStaticMarkup(
    createElement(PlaceFilterSummary, { filters, onReset: () => undefined }),
  )
}

describe('PlaceFilterSummary', () => {
  it('필터가 없으면 아무것도 렌더하지 않는다 (기본 상태의 세로 공간을 쓰지 않는다)', () => {
    expect(render(DEFAULT_PLACE_FILTERS)).toBe('')
  })

  it('적용된 필터를 한국어 라벨로 노출한다', () => {
    const markup = render({ ...DEFAULT_PLACE_FILTERS, contentType: 'RESTAURANT' })

    expect(markup).toContain('음식점')
  })

  it('여러 필터를 모두 노출한다', () => {
    const markup = render({
      ...DEFAULT_PLACE_FILTERS,
      contentType: 'LODGING',
      petAllowanceType: 'ALLOWED',
    })

    expect(markup).toContain('숙박')
    expect(markup).toContain('동반 가능')
  })

  it('초기화 버튼을 함께 노출한다', () => {
    const markup = render({ ...DEFAULT_PLACE_FILTERS, contentType: 'CULTURE' })

    expect(markup).toContain(messages.place.resetFilters)
  })

  it('결과 건수를 표기하지 않는다 (백엔드 SliceResponse 가 총계를 주지 않는다)', () => {
    const markup = render({ ...DEFAULT_PLACE_FILTERS, contentType: 'RESTAURANT' })

    expect(markup).not.toMatch(/\d+\s*(곳|개|건)/)
  })

  it('기본이 아닌 지역코드도 노출한다', () => {
    expect(render({ ...DEFAULT_PLACE_FILTERS, areaCode: '1' })).toContain('지역 1')
  })
})
