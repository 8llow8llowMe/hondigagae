import { describe, expect, it } from 'vitest'

import { shortAddress } from '@/lib/place/address'

describe('shortAddress — 행 메타 줄용 축약', () => {
  it('광역 접두를 버리고 읍·면까지 남긴다', () => {
    expect(shortAddress('제주특별자치도 제주시 한림읍 용금로 906-107')).toBe('제주시 한림읍')
  })

  it('동까지 있는 주소도 번지를 버린다', () => {
    expect(shortAddress('제주특별자치도 제주시 관덕로14길 20')).toBe('제주시')
  })

  it('리까지 남긴다', () => {
    expect(shortAddress('제주특별자치도 서귀포시 표선면 가시리')).toBe('서귀포시 표선면 가시리')
  })

  it('광역 접두가 없어도 동작한다', () => {
    expect(shortAddress('서귀포시 안덕면 신화역사로 15')).toBe('서귀포시 안덕면')
  })

  it('마디가 하나면 그것만 남긴다', () => {
    expect(shortAddress('제주시')).toBe('제주시')
  })

  /**
   * `features/home/place-insight-row.tsx` 에 같은 이름의 **사본**이 있었고, 그쪽은 광역
   * 접두를 뗀 뒤 앞 두 마디를 그대로 잘랐다 (이슈 #70 에서 제거).
   *
   * 사본은 두 곳에서 틀렸다:
   *  1. 제주 접두만 알아서 `서울특별시` 를 버리지 못했다
   *  2. 어절 수로 잘라 **도로명이 메타 줄에 샜다** (`제주시 관덕로14길`)
   *
   * 행정구역 접미로 판정하는 이쪽이 정본이다.
   */
  it('제주 밖 광역 접두도 버린다 — 사본은 제주만 알았다', () => {
    expect(shortAddress('서울특별시 강남구 테헤란로 1')).toBe('강남구')
  })

  it('도로명이 메타 줄에 새지 않는다 — 사본이 흘리던 것이다', () => {
    expect(shortAddress('제주특별자치도 제주시 관덕로14길 20')).not.toContain('관덕로')
  })

  /**
   * 원천마다 주소 품질이 다르다. **규칙에 걸리지 않으면 자르지 않는다** —
   * 억지로 자르면 뜻이 바뀐 문자열이 화면에 나간다.
   */
  it('행정구역 어절이 없으면 원문을 그대로 둔다', () => {
    expect(shortAddress('중문관광단지 내')).toBe('중문관광단지 내')
  })

  it('광역 접두만 있으면 그 뒤가 없어 원문을 그대로 둔다', () => {
    expect(shortAddress('제주특별자치도')).toBe('제주특별자치도')
  })

  it('null · 공백은 null 이다 — 메타 줄에서 빠진다', () => {
    expect(shortAddress(null)).toBeNull()
    expect(shortAddress('   ')).toBeNull()
  })

  it('앞뒤 공백과 중복 공백을 정리한다', () => {
    expect(shortAddress('  제주특별자치도  제주시   한림읍  ')).toBe('제주시 한림읍')
  })
})
