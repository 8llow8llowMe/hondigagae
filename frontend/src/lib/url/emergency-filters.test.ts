import { describe, expect, it } from 'vitest'

import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS } from '@/lib/api/emergency'
import {
  DEFAULT_EMERGENCY_BOARD_PARAMS,
  type EmergencyBoardParams,
  parseEmergencyBoardParams,
  RADIUS_OPTIONS,
  toEmergencyBoardQuery,
  widen,
} from '@/lib/url/emergency-filters'
import { DEFAULT_FACILITY_FILTERS } from '@/types/emergency'

describe('parseEmergencyBoardParams', () => {
  it('빈 URL 에서 기본값을 만든다', () => {
    expect(parseEmergencyBoardParams(new URLSearchParams())).toEqual(DEFAULT_EMERGENCY_BOARD_PARAMS)
  })

  it('허용된 시설 유형을 읽는다', () => {
    const params = new URLSearchParams('type=ANIMAL_PHARMACY')

    expect(parseEmergencyBoardParams(params).filters.type).toBe('ANIMAL_PHARMACY')
  })

  it('없는 시설 유형은 예외 없이 전체(null)로 떨어뜨린다 (URL 은 사용자가 고칠 수 있다)', () => {
    expect(parseEmergencyBoardParams(new URLSearchParams('type=CLINIC')).filters.type).toBeNull()
  })

  /*
    **읽지 못한 값은 «꺼짐» 이 아니라 «그 축의 기본값» 으로 떨어진다** (#654 E-3).
    `openNowOnly` 가 기본 ON 이 되면서 두 축의 답이 갈린다 — 예전처럼 `1` 을 일괄
    `false` 로 떨어뜨리면 기본 상태와 다른 화면이 열린다.
  */
  it('boolean 은 `true`·`false` 두 글자만 인정하고 나머지는 기본값이다', () => {
    const params = new URLSearchParams('open24Only=true&openNowOnly=1')

    expect(parseEmergencyBoardParams(params).filters).toMatchObject({
      open24Only: true,
      openNowOnly: DEFAULT_FACILITY_FILTERS.openNowOnly,
    })
  })

  /**
   * **기본 ON 인 축은 «꺼짐» 이 URL 에 실려야 한다** (#654 E-3). 이것이 깨지면
   * "지금 진료중을 끄고 공유한 링크가 켜진 채로 열린다".
   */
  it('기본 ON 인 축은 `false` 를 읽는다', () => {
    expect(
      parseEmergencyBoardParams(new URLSearchParams('openNowOnly=false')).filters.openNowOnly,
    ).toBe(false)
  })

  it('파라미터가 없으면 기본 상태다 — 지금 진료중이 켜져 있다', () => {
    expect(parseEmergencyBoardParams(new URLSearchParams('')).filters).toEqual(
      DEFAULT_FACILITY_FILTERS,
    )
  })

  /* 정규화 규칙 자체는 `lib/url/keyword.test.ts` 가 고정한다 — 여기서는 실리는지만 본다 */
  it('검색어를 읽고 앞뒤 공백을 걷는다 (#584)', () => {
    expect(parseEmergencyBoardParams(new URLSearchParams('keyword=한라')).filters.keyword).toBe(
      '한라',
    )
    expect(parseEmergencyBoardParams({ keyword: '  한라  ' }).filters.keyword).toBe('한라')
  })

  it('공백뿐이거나 상한을 넘는 검색어는 미지정이다', () => {
    expect(parseEmergencyBoardParams({ keyword: '   ' }).filters.keyword).toBeNull()
    expect(parseEmergencyBoardParams({ keyword: '가'.repeat(51) }).filters.keyword).toBeNull()
  })

  it('RADIUS_OPTIONS 에 있는 반경을 읽는다', () => {
    expect(parseEmergencyBoardParams(new URLSearchParams('radius=40000')).radius).toBe(40_000)
  })

  /*
    화이트리스트인 이유: 시트가 `draft === option` 으로 고르므로 목록에 없는 값이 들어오면
    칩은 "33.3km" 인데 시트에는 선택된 항목이 없는 화면이 된다.
  */
  it('RADIUS_OPTIONS 에 없는 반경은 기본값으로 떨어뜨린다', () => {
    expect(parseEmergencyBoardParams(new URLSearchParams('radius=33333')).radius).toBe(
      DEFAULT_RADIUS_METERS,
    )
    expect(parseEmergencyBoardParams(new URLSearchParams('radius=abc')).radius).toBe(
      DEFAULT_RADIUS_METERS,
    )
    expect(parseEmergencyBoardParams(new URLSearchParams('radius=')).radius).toBe(
      DEFAULT_RADIUS_METERS,
    )
  })

  it('server component 의 searchParams 객체 형태도 읽는다', () => {
    expect(parseEmergencyBoardParams({ type: 'ANIMAL_HOSPITAL' }).filters.type).toBe(
      'ANIMAL_HOSPITAL',
    )
  })

  it('배열로 들어온 값은 첫 항목만 쓴다', () => {
    expect(
      parseEmergencyBoardParams({ type: ['ANIMAL_PHARMACY', 'ANIMAL_HOSPITAL'] }).filters.type,
    ).toBe('ANIMAL_PHARMACY')
  })

  /** `view` 는 `lib/url/view-mode.ts` 소유다. 이 파서가 읽지도 내보내지도 않는다 */
  it('섞여 있는 `view` 키를 무시한다', () => {
    const params = new URLSearchParams('view=map&open24Only=true')

    expect(parseEmergencyBoardParams(params)).toEqual({
      filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true },
      radius: DEFAULT_RADIUS_METERS,
      regionCode: null,
    })
  })

  /*
    권역의 URL 직렬화 — 세부명세 D3-3 (#674). 값은 `JEJU_REGION_CODES` 의 코드
    그대로다 — `type=ANIMAL_HOSPITAL` 과 대칭이라 대소문자 왕복이 없다.
  */
  describe('권역 (#674)', () => {
    it('허용된 권역 코드를 읽는다', () => {
      expect(parseEmergencyBoardParams(new URLSearchParams('region=SEOGWIPO')).regionCode).toBe(
        'SEOGWIPO',
      )
    })

    it('키가 없으면 미선택(null)이다', () => {
      expect(parseEmergencyBoardParams(new URLSearchParams()).regionCode).toBeNull()
    })

    it('빈 값은 미선택이다', () => {
      expect(parseEmergencyBoardParams(new URLSearchParams('region=')).regionCode).toBeNull()
    })

    /*
      **화이트리스트는 대소문자를 가리지 않고 정확 일치만 본다.** 소문자로 낮춰 받으면
      대소문자 왕복이라는 새 매핑 레이어가 생긴다 (D3-3 "값을 대문자 코드로 두는 이유").
    */
    it('소문자는 미선택으로 떨어뜨린다', () => {
      expect(
        parseEmergencyBoardParams(new URLSearchParams('region=seogwipo')).regionCode,
      ).toBeNull()
    })

    /** 한라산권은 4권역에 없다 (D8-3) — 있어도 고를 수 없는 권역이라 함정이다 */
    it('없는 권역 코드는 미선택으로 떨어뜨린다', () => {
      expect(parseEmergencyBoardParams(new URLSearchParams('region=HALLA')).regionCode).toBeNull()
    })

    it('배열로 들어오면 첫 값을 쓴다', () => {
      expect(
        parseEmergencyBoardParams(new URLSearchParams('region=EAST&region=WEST')).regionCode,
      ).toBe('EAST')
    })
  })
})

describe('toEmergencyBoardQuery', () => {
  it('기본값은 통째로 생략한다 — 빈 URL = 기본 상태', () => {
    expect(toEmergencyBoardQuery(DEFAULT_EMERGENCY_BOARD_PARAMS)).toBe('')
  })

  it('boolean 은 기본값과 다를 때만 키를 넣는다', () => {
    const query = toEmergencyBoardQuery({
      filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true },
      radius: DEFAULT_RADIUS_METERS,
      regionCode: null,
    })

    expect(query).toBe('open24Only=true')
  })

  /*
    **기본 ON 인 축은 «켜짐» 이 아니라 «꺼짐» 이 실린다** (#654 E-3). `if (flag)` 로
    두면 끈 것이 URL 에 남지 않아 새로고침·공유에서 도로 켜진다.
  */
  it('기본 ON 인 축은 꺼졌을 때 false 를 싣는다', () => {
    expect(
      toEmergencyBoardQuery({
        filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: false },
        radius: DEFAULT_RADIUS_METERS,
        regionCode: null,
      }),
    ).toBe('openNowOnly=false')
    expect(toEmergencyBoardQuery(DEFAULT_EMERGENCY_BOARD_PARAMS)).not.toContain('openNowOnly')
  })

  it('기본 반경은 생략하고 넓힌 반경만 싣는다', () => {
    expect(
      toEmergencyBoardQuery({
        filters: DEFAULT_FACILITY_FILTERS,
        radius: DEFAULT_RADIUS_METERS,
        regionCode: null,
      }),
    ).toBe('')
    expect(
      toEmergencyBoardQuery({
        filters: DEFAULT_FACILITY_FILTERS,
        radius: 40_000,
        regionCode: null,
      }),
    ).toBe('radius=40000')
  })

  it('검색어는 값이 있을 때만 키를 넣는다 (#584)', () => {
    expect(
      toEmergencyBoardQuery({
        filters: { ...DEFAULT_FACILITY_FILTERS, keyword: '한라' },
        radius: DEFAULT_RADIUS_METERS,
        regionCode: null,
      }),
    ).toBe('keyword=%ED%95%9C%EB%9D%BC')
    expect(toEmergencyBoardQuery(DEFAULT_EMERGENCY_BOARD_PARAMS)).not.toContain('keyword')
  })

  it('`view` 를 내보내지 않는다', () => {
    expect(
      toEmergencyBoardQuery({
        filters: DEFAULT_FACILITY_FILTERS,
        radius: 20_000,
        regionCode: null,
      }),
    ).not.toContain('view')
  })

  /* 권역의 URL 직렬화 — 세부명세 D3-3 (#674) */
  describe('권역 (#674)', () => {
    it('미선택이면 `region` 키가 없다', () => {
      expect(toEmergencyBoardQuery(DEFAULT_EMERGENCY_BOARD_PARAMS)).not.toContain('region')
    })

    it('고른 권역은 코드 그대로 싣는다 — 대문자, 매핑 없음', () => {
      expect(
        toEmergencyBoardQuery({
          filters: DEFAULT_FACILITY_FILTERS,
          radius: DEFAULT_RADIUS_METERS,
          regionCode: 'EAST',
        }),
      ).toBe('region=EAST')
    })
  })
})

/*
  기본값 생략 규칙 때문에 이 테스트가 실제로 버그를 잡는다 (architecture-guide.md §10).
*/
describe('왕복', () => {
  const cases: EmergencyBoardParams[] = [
    DEFAULT_EMERGENCY_BOARD_PARAMS,
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_HOSPITAL' },
      radius: 10_000,
      regionCode: null,
    },
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, open24Only: true, openNowOnly: true },
      radius: 40_000,
      regionCode: null,
    },
    // 기본 ON 인 축을 끈 왕복 — 생략 규칙이 뒤집히는 자리다 (#654)
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: false },
      radius: DEFAULT_RADIUS_METERS,
      regionCode: null,
    },
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, openNowOnly: false, open24Only: true },
      radius: 20_000,
      regionCode: null,
    },
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_PHARMACY', open24Only: true },
      radius: MAX_RADIUS_METERS,
      regionCode: null,
    },
    // 검색어가 실린 왕복 — 공백을 품은 검색어까지 (#584)
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, keyword: '제주 동물병원' },
      radius: DEFAULT_RADIUS_METERS,
      regionCode: null,
    },
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, keyword: '한라', open24Only: true },
      radius: 20_000,
      regionCode: null,
    },
    // 권역 왕복 — 네 권역 전부 (#674 D3-3)
    { filters: DEFAULT_FACILITY_FILTERS, radius: DEFAULT_RADIUS_METERS, regionCode: 'JEJU_CITY' },
    { filters: DEFAULT_FACILITY_FILTERS, radius: DEFAULT_RADIUS_METERS, regionCode: 'SEOGWIPO' },
    { filters: DEFAULT_FACILITY_FILTERS, radius: DEFAULT_RADIUS_METERS, regionCode: 'EAST' },
    { filters: DEFAULT_FACILITY_FILTERS, radius: DEFAULT_RADIUS_METERS, regionCode: 'WEST' },
    // 권역과 다른 축이 함께 실린 왕복
    {
      filters: { ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_HOSPITAL', keyword: '서귀포' },
      radius: 20_000,
      regionCode: 'SEOGWIPO',
    },
  ]

  it.each(cases)('parse(toQuery(p)) === p — %j', (params) => {
    expect(parseEmergencyBoardParams(new URLSearchParams(toEmergencyBoardQuery(params)))).toEqual(
      params,
    )
  })
})

describe('widen', () => {
  it('한 번에 두 배로 넓힌다', () => {
    expect(widen(10_000)).toBe(20_000)
    expect(widen(20_000)).toBe(40_000)
  })

  it('상한에서 멈춘다 — 40km 다음은 80km 가 아니라 50km 다', () => {
    expect(widen(40_000)).toBe(MAX_RADIUS_METERS)
    expect(widen(MAX_RADIUS_METERS)).toBe(MAX_RADIUS_METERS)
  })

  it('선택지는 사다리와 상한을 따른다', () => {
    expect(RADIUS_OPTIONS).toEqual([10_000, 20_000, 40_000, MAX_RADIUS_METERS])
  })

  /** 사다리가 시트 선택지 밖으로 나가면 칩이 목록에 없는 값을 가리킨다 */
  it('사다리가 RADIUS_OPTIONS 안에서만 움직인다', () => {
    for (const option of RADIUS_OPTIONS) {
      expect(RADIUS_OPTIONS).toContain(widen(option))
    }
  })
})
