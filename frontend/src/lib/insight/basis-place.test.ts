import { describe, expect, it } from 'vitest'

import { DEFAULT_BASIS_PLACE_ID, isDefaultBasis } from '@/lib/insight/basis-place'

describe('DEFAULT_BASIS_PLACE_ID', () => {
  /*
    **값을 테스트가 붙잡는다** (홈-첫방문-판정-세부명세 D3-2). 이 상수는 dev `GET /places`
    실측으로 고른 것이라 눈으로만 관리하면 "왜 이 숫자인가" 를 잃은 채 조용히 바뀐다.
    바꿀 이유가 생기면 명세 D3-2 와 이 줄을 같이 고치게 둔다.
  */
  it('사라봉공원(126454)이다', () => {
    expect(DEFAULT_BASIS_PLACE_ID).toBe('126454')
  })
})

describe('isDefaultBasis', () => {
  it('대표 지점이면 true 다', () => {
    expect(isDefaultBasis(DEFAULT_BASIS_PLACE_ID)).toBe(true)
  })

  it('사용자가 고른 장소면 false 다', () => {
    expect(isDefaultBasis('111')).toBe(false)
  })

  /*
    **`null` 은 대표 지점이 아니다.** 기준이 아예 없는 상태(판정 미렌더)와 대표 지점으로
    떨어진 상태는 화면이 다르다 — 전자는 캡션을 붙일 판정 줄 자체가 없다.
  */
  it('기준이 없으면 false 다', () => {
    expect(isDefaultBasis(null)).toBe(false)
  })
})
