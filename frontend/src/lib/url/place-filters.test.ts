import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AREA_CODE,
  DEFAULT_PLACE_FILTERS,
  parsePlaceFilters,
  toPlaceApiQuery,
  toPlaceFilterQuery,
} from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

describe('parsePlaceFilters', () => {
  it('빈 URL 에서 기본값을 만든다', () => {
    expect(parsePlaceFilters(new URLSearchParams())).toEqual(DEFAULT_PLACE_FILTERS)
  })

  it('허용된 enum 값을 읽는다', () => {
    const params = new URLSearchParams('contentType=RESTAURANT&petAllowanceType=ALLOWED')

    expect(parsePlaceFilters(params)).toMatchObject({
      contentType: 'RESTAURANT',
      petAllowanceType: 'ALLOWED',
    })
  })

  it('허용되지 않은 enum 값은 예외 없이 null 로 떨어뜨린다 (URL 은 사용자가 고칠 수 있다)', () => {
    const params = new URLSearchParams('contentType=CAFE&petAllowanceType=MAYBE')

    expect(parsePlaceFilters(params)).toMatchObject({
      contentType: null,
      petAllowanceType: null,
    })
  })

  it('빈 문자열 areaCode 는 기본값으로 떨어뜨린다', () => {
    expect(parsePlaceFilters(new URLSearchParams('areaCode=')).areaCode).toBe(DEFAULT_AREA_CODE)
  })

  it('server component 의 searchParams 객체 형태도 읽는다', () => {
    expect(parsePlaceFilters({ contentType: 'LODGING' }).contentType).toBe('LODGING')
  })

  it('배열로 들어온 값은 첫 항목만 쓴다', () => {
    expect(parsePlaceFilters({ contentType: ['CULTURE', 'LEPORTS'] }).contentType).toBe('CULTURE')
  })
})

describe('parsePlaceFilters — 새 필터', () => {
  it('indoor 는 true/false 만 인정한다', () => {
    expect(parsePlaceFilters(new URLSearchParams('indoor=true')).indoor).toBe(true)
    expect(parsePlaceFilters(new URLSearchParams('indoor=false')).indoor).toBe(false)
  })

  it('indoor 에 이상한 값이 오면 미지정으로 떨어뜨린다', () => {
    expect(parsePlaceFilters(new URLSearchParams('indoor=maybe')).indoor).toBeNull()
    expect(parsePlaceFilters(new URLSearchParams('indoor=1')).indoor).toBeNull()
  })

  it('허용되지 않은 allowedPetSize 는 null 로 떨어뜨린다', () => {
    expect(parsePlaceFilters(new URLSearchParams('allowedPetSize=HUGE')).allowedPetSize).toBeNull()
  })

  it('petSizeType 은 반려견 크기 코드만 받는다', () => {
    expect(parsePlaceFilters(new URLSearchParams('petSizeType=SMALL')).petSizeType).toBe('SMALL')
    // 장소 축(`allowedPetSize`)의 코드를 여기 넣으면 백엔드가 400 이다 — 미지정으로 떨군다
    expect(parsePlaceFilters(new URLSearchParams('petSizeType=SMALL_ONLY')).petSizeType).toBeNull()
  })

  it('sourceCategory 는 자유 문자열이라 그대로 받는다', () => {
    expect(parsePlaceFilters(new URLSearchParams('sourceCategory=카페')).sourceCategory).toBe(
      '카페',
    )
  })

  it('공백뿐인 sourceCategory 는 미지정으로 본다', () => {
    expect(parsePlaceFilters({ sourceCategory: '   ' }).sourceCategory).toBeNull()
  })

  it('keyword 는 앞뒤 공백을 지운 문자열이다', () => {
    expect(parsePlaceFilters(new URLSearchParams('keyword=성산')).keyword).toBe('성산')
    expect(parsePlaceFilters({ keyword: '  성산  ' }).keyword).toBe('성산')
  })

  it('공백뿐인 keyword 와 51자는 미지정이다', () => {
    expect(parsePlaceFilters({ keyword: '   ' }).keyword).toBeNull()
    expect(parsePlaceFilters({ keyword: '가'.repeat(51) }).keyword).toBeNull()
  })
})

describe('toPlaceFilterQuery', () => {
  it('기본값은 URL 에서 생략한다 (빈 URL = 기본 상태)', () => {
    expect(toPlaceFilterQuery(DEFAULT_PLACE_FILTERS)).toBe('')
  })

  it('기본값이 아닌 지역코드는 표기한다', () => {
    expect(toPlaceFilterQuery({ ...DEFAULT_PLACE_FILTERS, areaCode: '1' })).toBe('areaCode=1')
  })

  it('커서와 size 는 URL 에 넣지 않는다', () => {
    const query = toPlaceFilterQuery({ ...DEFAULT_PLACE_FILTERS, contentType: 'RESTAURANT' })

    expect(query).not.toContain('lastPlaceId')
    expect(query).not.toContain('size')
  })
})

describe('round-trip', () => {
  const cases: PlaceFilters[] = [
    DEFAULT_PLACE_FILTERS,
    { ...DEFAULT_PLACE_FILTERS, sigunguCode: '4' },
    {
      ...DEFAULT_PLACE_FILTERS,
      areaCode: '1',
      contentType: 'RESTAURANT',
      petAllowanceType: 'ALLOWED',
    },
    {
      ...DEFAULT_PLACE_FILTERS,
      sigunguCode: '3',
      contentType: 'LODGING',
      petAllowanceType: 'PARTIALLY_ALLOWED',
    },
    { ...DEFAULT_PLACE_FILTERS, indoor: true },
    { ...DEFAULT_PLACE_FILTERS, indoor: false },
    { ...DEFAULT_PLACE_FILTERS, allowedPetSize: 'SMALL_ONLY' },
    { ...DEFAULT_PLACE_FILTERS, petSizeType: 'MEDIUM' },
    { ...DEFAULT_PLACE_FILTERS, sourceCategory: '카페' },
    { ...DEFAULT_PLACE_FILTERS, keyword: '성산' },
    {
      ...DEFAULT_PLACE_FILTERS,
      indoor: true,
      allowedPetSize: 'ALL',
      sourceCategory: '펜션',
      contentType: 'LODGING',
    },
  ]

  it.each(cases)('parse(toQuery(f)) 가 f 와 같다: %o', (filters) => {
    const restored = parsePlaceFilters(new URLSearchParams(toPlaceFilterQuery(filters)))

    expect(restored).toEqual(filters)
  })
})

describe('toPlaceApiQuery', () => {
  it('API 호출에는 기본값도 명시하고 size 를 포함한다', () => {
    const query = toPlaceApiQuery(DEFAULT_PLACE_FILTERS)

    expect(query).toContain(`areaCode=${DEFAULT_AREA_CODE}`)
    expect(query).toContain('size=20')
  })

  it('커서를 lastPlaceId 로 보낸다', () => {
    const query = toPlaceApiQuery(DEFAULT_PLACE_FILTERS, '212481712381923328')

    expect(query).toContain('lastPlaceId=212481712381923328')
  })

  it('커서가 없으면 lastPlaceId 를 보내지 않는다', () => {
    expect(toPlaceApiQuery(DEFAULT_PLACE_FILTERS)).not.toContain('lastPlaceId')
  })
})

describe('petWeightKg — 내 반려견 체중 필터', () => {
  it('기본값은 미지정이다', () => {
    expect(parsePlaceFilters({}).petWeightKg).toBeNull()
  })

  it('정수를 읽는다', () => {
    expect(parsePlaceFilters({ petWeightKg: '12' }).petWeightKg).toBe(12)
  })

  it('소수는 미지정으로 떨어뜨린다 — 백엔드 파라미터가 Integer 라 400 이 된다', () => {
    expect(parsePlaceFilters({ petWeightKg: '3.5' }).petWeightKg).toBeNull()
  })

  it('숫자가 아니면 미지정이다 — URL 은 사용자가 손으로 고친다', () => {
    expect(parsePlaceFilters({ petWeightKg: '무거움' }).petWeightKg).toBeNull()
    expect(parsePlaceFilters({ petWeightKg: '-5' }).petWeightKg).toBeNull()
  })

  it('화면 URL 과 API 쿼리 양쪽에 실린다', () => {
    const filters = { ...DEFAULT_PLACE_FILTERS, petSizeType: 'SMALL' as const, petWeightKg: 4 }

    expect(toPlaceFilterQuery(filters)).toContain('petWeightKg=4')
    expect(toPlaceApiQuery(filters)).toContain('petWeightKg=4')
  })

  it('왕복해도 값이 유지된다', () => {
    const filters = { ...DEFAULT_PLACE_FILTERS, petSizeType: 'MEDIUM' as const, petWeightKg: 12 }

    expect(parsePlaceFilters(new URLSearchParams(toPlaceFilterQuery(filters)))).toEqual(filters)
  })
})
