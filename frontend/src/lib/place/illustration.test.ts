import { describe, expect, it } from 'vitest'

import { placeIllustration } from '@/lib/place/illustration'

describe('placeIllustration — 아는 것(카테고리)만 그린다', () => {
  /*
    **회색 타일이 대부분이었다.** dev 실측(제주 400건): `firstImage` 없는 장소가
    281건(70%)이고 숙박 87%·문화시설 95% 다. `contentType` 은 응답에 이미 있으니
    그 값으로 카테고리 일러스트를 고른다.

    **사진인 척하지 않는다.** 플랫 일러스트라 사진과 구분되고, 우리가 모르는 것(그
    장소의 실제 모습)이 아니라 아는 것(카테고리)만 말한다.
  */
  it('제주 데이터에 등장하는 4종에 자산을 준다', () => {
    expect(placeIllustration('RESTAURANT')).toBe('/illustrations/place-restaurant.svg')
    expect(placeIllustration('LODGING')).toBe('/illustrations/place-lodging.svg')
    expect(placeIllustration('CULTURE')).toBe('/illustrations/place-culture.svg')
    expect(placeIllustration('TOURIST_SPOT')).toBe('/illustrations/place-tourist_spot.svg')
  })

  /**
   * 자산이 없는 코드는 **회색 타일로 떨어진다.** 스펙의 나머지 4종
   * (`FESTIVAL`/`COURSE`/`LEPORTS`/`SHOPPING`)은 제주 데이터에 아직 없다 —
   * 자산을 넣으면 여기 한 줄만 늘려 붙는다.
   */
  it('자산이 없는 코드는 null 이다 — 없는 카테고리를 지어내지 않는다', () => {
    expect(placeIllustration('FESTIVAL')).toBe(null)
    expect(placeIllustration('SHOPPING')).toBe(null)
    expect(placeIllustration('NEW_CODE_FROM_SERVER')).toBe(null)
  })

  it('코드가 없으면 null 이다', () => {
    expect(placeIllustration(null)).toBe(null)
    expect(placeIllustration('')).toBe(null)
  })
})
