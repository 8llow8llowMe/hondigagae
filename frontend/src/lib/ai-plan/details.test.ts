import { describe, expect, it } from 'vitest'

import { type DetailsInput, detailsSummary, hasAnyDetail } from '@/lib/ai-plan/details'

const EMPTY: DetailsInput = {
  regionLabel: '제주 전체',
  regionNarrowed: false,
  budgetManwon: '',
  preferFavorites: false,
  pinnedCount: 0,
}

describe('detailsSummary — 접힌 줄이 무엇이 정해졌는지 말한다', () => {
  it('아무것도 안 정했으면 기본값을 그대로 읽어 준다', () => {
    expect(detailsSummary(EMPTY)).toBe('제주 전체 · 예산 상관없음')
  })

  it('좁힌 지역과 예산을 값으로 바꿔 넣는다', () => {
    const summary = detailsSummary({
      ...EMPTY,
      regionLabel: '서귀포시',
      regionNarrowed: true,
      budgetManwon: '30',
    })

    expect(summary).toBe('서귀포시 · 30만원')
  })

  it('켠 옵션만 뒤에 덧붙인다', () => {
    const summary = detailsSummary({
      ...EMPTY,
      preferFavorites: true,
      pinnedCount: 2,
    })

    expect(summary).toBe('제주 전체 · 예산 상관없음 · 저장한 곳 우선 · 꼭 넣을 곳 2')
  })

  it('고정 장소가 없으면 그 조각을 넣지 않는다', () => {
    expect(detailsSummary({ ...EMPTY, preferFavorites: true })).toBe(
      '제주 전체 · 예산 상관없음 · 저장한 곳 우선',
    )
  })
})

describe('hasAnyDetail — 하나라도 정했으면 펼친 채로 연다', () => {
  it('전부 기본값이면 접는다', () => {
    expect(hasAnyDetail(EMPTY)).toBe(false)
  })

  it('지역을 좁혔으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, regionNarrowed: true, regionLabel: '제주시' })).toBe(true)
  })

  it('예산을 적었으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, budgetManwon: '30' })).toBe(true)
  })

  it('저장한 곳 우선을 켰으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, preferFavorites: true })).toBe(true)
  })

  it('고정 장소가 있으면 펼친다', () => {
    expect(hasAnyDetail({ ...EMPTY, pinnedCount: 1 })).toBe(true)
  })
})
