import { describe, expect, it } from 'vitest'

import {
  CONTENT_TYPE_FILTER_ORDER,
  CONTENT_TYPE_LABEL,
  PLACE_KIND_FILTER_ORDER,
  PLACE_KIND_LABEL,
  placeKindOf,
  withPlaceKind,
} from '@/features/place/filter-labels'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import { CONTENT_TYPE_CODES } from '@/types/place'

/**
 * 화면 순서(`CONTENT_TYPE_FILTER_ORDER`)와 계약 순서(`CONTENT_TYPE_CODES`)를 **일부러
 * 갈라 뒀다.** 그래서 백엔드에 enum 값이 하나 추가되면 화면 목록에서 **조용히 빠진다** —
 * 라벨 표만 채우고 순서 배열을 잊는 것이 그 사고의 경로다. 여기서 잡는다.
 */
describe('유형 필터 표시 순서', () => {
  it('계약의 모든 코드를 정확히 한 번씩 담는다', () => {
    expect([...CONTENT_TYPE_FILTER_ORDER].sort()).toEqual([...CONTENT_TYPE_CODES].sort())
  })

  it('모든 코드에 라벨이 있다', () => {
    for (const code of CONTENT_TYPE_FILTER_ORDER) {
      expect(CONTENT_TYPE_LABEL[code]).toBeTruthy()
    }
  })

  it('갈 곳 → 먹을 곳 → 잘 곳 순이다 — 지도 필터 줄에서 앞 셋만 스크롤 없이 보인다', () => {
    expect(CONTENT_TYPE_FILTER_ORDER.slice(0, 3)).toEqual(['TOURIST_SPOT', 'RESTAURANT', 'LODGING'])
  })
})

/*
  **카페는 콘텐츠 유형이 아니다** (#1156). 백엔드 `contentType` 에 카페가 없어(음식점에 섞여 있다)
  "강아지랑 갈 카페" 를 찾는 사용자가 좁힐 방법이 없었다 (2026-10-06 사용성 점검). 원천 분류
  `sourceCategory=카페` 를 음식점과 함께 걸어 한 칩으로 낸다.
*/
describe('장소 종류 — 유형 + 카페 (#1156)', () => {
  it('유형 순서를 그대로 지키고 카페를 음식점 바로 뒤에 둔다', () => {
    expect(PLACE_KIND_FILTER_ORDER.filter((kind) => kind !== 'CAFE')).toEqual([
      ...CONTENT_TYPE_FILTER_ORDER,
    ])
    const restaurant = PLACE_KIND_FILTER_ORDER.indexOf('RESTAURANT')
    expect(PLACE_KIND_FILTER_ORDER[restaurant + 1]).toBe('CAFE')
  })

  it('모든 종류에 라벨이 있다', () => {
    for (const kind of PLACE_KIND_FILTER_ORDER) expect(PLACE_KIND_LABEL[kind]).toBeTruthy()
    expect(PLACE_KIND_LABEL.CAFE).toBe('카페')
  })

  it('카페를 고르면 음식점 + 카페 분류를 함께 건다', () => {
    const next = withPlaceKind(DEFAULT_PLACE_FILTERS, 'CAFE')

    expect(next.contentType).toBe('RESTAURANT')
    expect(next.sourceCategory).toBe('카페')
    expect(placeKindOf(next)).toBe('CAFE')
  })

  it('음식점을 고르면 카페 분류를 푼다 — 음식점과 카페가 함께 켜져 보이지 않게', () => {
    const next = withPlaceKind(withPlaceKind(DEFAULT_PLACE_FILTERS, 'CAFE'), 'RESTAURANT')

    expect(next.contentType).toBe('RESTAURANT')
    expect(next.sourceCategory).toBeNull()
    expect(placeKindOf(next)).toBe('RESTAURANT')
  })

  it('전체는 둘 다 푼다', () => {
    const next = withPlaceKind(withPlaceKind(DEFAULT_PLACE_FILTERS, 'CAFE'), null)

    expect(next.contentType).toBeNull()
    expect(next.sourceCategory).toBeNull()
    expect(placeKindOf(next)).toBeNull()
  })

  it('다른 축(검색어 · 동반)은 건드리지 않는다', () => {
    const base = { ...DEFAULT_PLACE_FILTERS, keyword: '애월', petAllowanceType: 'ALLOWED' as const }
    const next = withPlaceKind(base, 'CAFE')

    expect(next.keyword).toBe('애월')
    expect(next.petAllowanceType).toBe('ALLOWED')
  })

  it('주소로 카페 분류만 걸려 와도 카페로 읽는다', () => {
    expect(placeKindOf({ ...DEFAULT_PLACE_FILTERS, sourceCategory: '카페' })).toBe('CAFE')
  })
})
