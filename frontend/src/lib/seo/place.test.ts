import { describe, expect, it } from 'vitest'

import {
  isIndexablePlace,
  PLACE_DESCRIPTION_LIMIT,
  placeSeoDescription,
  placeSeoTitle,
} from '@/lib/seo/place'
import { placeDetail } from '@/test/fixtures/place'
import type { EnumMetadata } from '@/types/api'

const allowance = (code: string, name: string): EnumMetadata => ({ code, name })

describe('isIndexablePlace — 동반 정보가 있는 곳만 색인한다 (#1130)', () => {
  it.each([
    ['ALLOWED', true],
    ['PARTIALLY_ALLOWED', true],
    ['NOT_ALLOWED', true],
    ['UNKNOWN', false],
  ])('%s → %s', (code, expected) => {
    expect(isIndexablePlace({ ...placeDetail, petAllowanceType: allowance(code, '이름') })).toBe(
      expected,
    )
  })

  it('원천에서 사라진 장소는 동반 가능이어도 색인하지 않는다', () => {
    expect(
      isIndexablePlace({
        ...placeDetail,
        delisted: true,
        petAllowanceType: allowance('ALLOWED', '동반 가능'),
      }),
    ).toBe(false)
  })
})

describe('placeSeoTitle', () => {
  it('장소명 + 반려견 + 서버 동반 이름', () => {
    expect(placeSeoTitle(placeDetail)).toBe(
      '제주특별자치도립김창열미술관 반려견 부분 동반 가능 · 혼디가개',
    )
  })

  it('동반 정보가 없으면 장소명만 — "정보 없음" 을 제목에 싣지 않는다', () => {
    const title = placeSeoTitle({
      ...placeDetail,
      petAllowanceType: allowance('UNKNOWN', '정보 없음'),
    })

    expect(title).toBe('제주특별자치도립김창열미술관 · 혼디가개')
  })
})

describe('placeSeoDescription — 동반 조건으로 시작한다', () => {
  it('동반 · 크기 · 분류 · 짧은 주소 뒤에 개요 평문', () => {
    expect(placeSeoDescription(placeDetail)).toBe(
      '반려견 부분 동반 가능 · 전 견종 가능 · 문화시설 · 제주시 한림읍. 제주 자연을 그대로 살린 공간이다. 야외 동선에서 반려견과 함께 산책할 수 있다.',
    )
  })

  it('동반 정보·크기 정보가 없으면 그 칸을 비운다', () => {
    const description = placeSeoDescription({
      ...placeDetail,
      petAllowanceType: allowance('UNKNOWN', '정보 없음'),
      petInfo: null,
      overview: null,
    })

    expect(description).toBe('문화시설 · 제주시 한림읍')
  })

  it('분류어 한 단어짜리 개요는 붙이지 않는다', () => {
    expect(placeSeoDescription({ ...placeDetail, overview: '박물관' })).toBe(
      '반려견 부분 동반 가능 · 전 견종 가능 · 문화시설 · 제주시 한림읍',
    )
  })

  it('길면 자르고 말줄임표를 붙인다', () => {
    const description = placeSeoDescription({ ...placeDetail, overview: '가'.repeat(400) })

    expect(description).toHaveLength(PLACE_DESCRIPTION_LIMIT + 1)
    expect(description.endsWith('…')).toBe(true)
  })
})
