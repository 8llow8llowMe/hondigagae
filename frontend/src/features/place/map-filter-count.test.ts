import { describe, expect, it } from 'vitest'

import { mapSheetFilterCount } from '@/features/place/map-filter-count'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

function count(patch: Partial<PlaceFilters>): number {
  return mapSheetFilterCount({ ...DEFAULT_PLACE_FILTERS, ...patch })
}

describe('mapSheetFilterCount — `필터 n` 의 n 은 시트 안 축만 센다 (#1314 D1-2)', () => {
  it('기본값이면 0', () => {
    expect(mapSheetFilterCount(DEFAULT_PLACE_FILTERS)).toBe(0)
  })

  it('지역 · 실내 · 야외는 각 1', () => {
    expect(count({ sigunguCode: '3' })).toBe(1)
    expect(count({ indoor: true })).toBe(1)
    expect(count({ indoor: false })).toBe(1)
  })

  it('체구는 체중과 한 축이라 함께 켜져도 1', () => {
    expect(count({ petSizeType: 'SMALL' })).toBe(1)
    expect(count({ petSizeType: 'SMALL', petWeightKg: 5 })).toBe(1)
  })

  it('세 축이 다 걸리면 3', () => {
    expect(count({ sigunguCode: '4', indoor: false, petSizeType: 'LARGE', petWeightKg: 30 })).toBe(
      3,
    )
  })

  it('레일에 보이는 축 · 검색어 · 화면이 쓰지 않는 allowedPetSize 는 세지 않는다', () => {
    expect(count({ contentType: 'RESTAURANT' })).toBe(0)
    expect(count({ sourceCategory: '카페' })).toBe(0)
    expect(count({ petAllowanceType: 'ALLOWED' })).toBe(0)
    expect(count({ keyword: '오름' })).toBe(0)
    expect(count({ allowedPetSize: 'SMALL_ONLY' })).toBe(0)
  })
})
