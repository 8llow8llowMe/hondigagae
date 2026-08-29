import { describe, expect, it } from 'vitest'

import { allowsPetSize, petSizeVerdict } from '@/lib/place/pet-size'

describe('allowsPetSize — backend AllowedPetSize#allows 이식', () => {
  it('ALL 은 모든 크기를 받는다', () => {
    expect(allowsPetSize('ALL', 'LARGE')).toBe(true)
  })

  it('SMALL_ONLY 는 소형견만 받는다', () => {
    expect(allowsPetSize('SMALL_ONLY', 'SMALL')).toBe(true)
    expect(allowsPetSize('SMALL_ONLY', 'MEDIUM')).toBe(false)
    expect(allowsPetSize('SMALL_ONLY', 'LARGE')).toBe(false)
  })

  it('SMALL_MEDIUM 은 대형견만 거른다', () => {
    expect(allowsPetSize('SMALL_MEDIUM', 'MEDIUM')).toBe(true)
    expect(allowsPetSize('SMALL_MEDIUM', 'LARGE')).toBe(false)
  })

  it('UNKNOWN 은 걸러내지 않는다 — 정보 없음을 "불가" 로 단정하지 않는다', () => {
    expect(allowsPetSize('UNKNOWN', 'LARGE')).toBe(true)
  })

  it('기준이 되는 반려견이 없으면 아무것도 거르지 않는다', () => {
    expect(allowsPetSize('SMALL_ONLY', null)).toBe(true)
  })
})

describe('petSizeVerdict — 화면 문장용 판정은 통과 여부와 축이 다르다', () => {
  it('받아 주면 allowed', () => {
    expect(petSizeVerdict('SMALL_ONLY', 'SMALL')).toBe('allowed')
  })

  it('받지 않으면 blocked', () => {
    expect(petSizeVerdict('SMALL_ONLY', 'LARGE')).toBe('blocked')
  })

  it('UNKNOWN 은 allowed 가 아니라 unknown 이다 — 모름을 확신처럼 말하지 않는다', () => {
    expect(allowsPetSize('UNKNOWN', 'LARGE')).toBe(true)
    expect(petSizeVerdict('UNKNOWN', 'LARGE')).toBe('unknown')
  })

  it('반려견이 없으면 대입할 기준이 없어 unknown 이다', () => {
    expect(petSizeVerdict('ALL', null)).toBe('unknown')
  })

  it('모르는 code 를 통과로 읽지 않는다 — 계약이 늘어나면 여기서 드러난다', () => {
    expect(petSizeVerdict('BRAND_NEW_CODE', 'SMALL')).toBe('unknown')
  })
})
