import { describe, expect, it } from 'vitest'

import { shortAddress } from '@/features/home/place-insight-row'

describe('shortAddress — 메타 줄 (아트보드 01/02)', () => {
  it('광역 접두사를 떼고 앞 두 마디만 남긴다', () => {
    expect(shortAddress('제주특별자치도 제주시 한림읍 용금로 906-107')).toBe('제주시 한림읍')
  })

  it('전체 주소를 쓰지 않는다 — 375px 에서 두 줄을 먹고 제목을 밀어낸다', () => {
    const full = '제주특별자치도 서귀포시 안덕면 신화역사로 15'

    expect(shortAddress(full)).not.toBe(full)
    expect(shortAddress(full)).toBe('서귀포시 안덕면')
  })

  it('광역 접두사가 없으면 그대로 앞 두 마디를 쓴다', () => {
    expect(shortAddress('서울특별시 강남구 테헤란로 1')).toBe('서울특별시 강남구')
  })

  it('마디가 하나면 그것만 남긴다', () => {
    expect(shortAddress('제주시')).toBe('제주시')
  })

  it('null · 빈 문자열은 null 이다 — 호출부가 줄을 숨긴다', () => {
    expect(shortAddress(null)).toBeNull()
    expect(shortAddress('   ')).toBeNull()
  })
})
