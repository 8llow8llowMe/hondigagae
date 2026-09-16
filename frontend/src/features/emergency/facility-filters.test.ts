import { describe, expect, it } from 'vitest'

import {
  applyFilters,
  countsAreComplete,
  facilityCounts,
  matchesKeyword,
  narrowByKeyword,
  reliefs,
} from '@/features/emergency/facility-filters'
import { MAX_SIZE } from '@/lib/api/emergency'
import {
  DEFAULT_FACILITY_FILTERS,
  type FacilityFilters,
  type NearbyFacilityItem,
} from '@/types/emergency'

function facility(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return {
    facilityId: '4611686018427387904',
    facilityType: { code: 'ANIMAL_HOSPITAL', name: '동물병원', description: null },
    name: '제주동물병원',
    addr: '제주특별자치도 제주시 연북로 100',
    lat: 33.48,
    lng: 126.49,
    tel: '064-000-0000',
    operatingHours: '09:00~19:00',
    restDate: null,
    open24: false,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 500,
    ...overrides,
  }
}

const HOSPITAL_24 = facility({ facilityId: '1', open24: true, openNow: true })
const HOSPITAL_OPEN = facility({ facilityId: '2', distanceMeters: 1200 })
const HOSPITAL_UNKNOWN = facility({
  facilityId: '3',
  openNow: null,
  operatingHoursKnown: false,
  distanceMeters: 3100,
})
const PHARMACY_CLOSED = facility({
  facilityId: '4',
  facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
  openNow: false,
  distanceMeters: 4400,
})

const ALL = [HOSPITAL_24, HOSPITAL_OPEN, HOSPITAL_UNKNOWN, PHARMACY_CLOSED]

/**
 * **아무 축도 걸지 않은 상태** — `DEFAULT_FACILITY_FILTERS` 가 아니다 (#654 E-3).
 *
 * 기본값은 이제 `openNowOnly: true` 다. "조건이 없으면" 을 재는 단언에서 그것을 그대로
 * 쓰면 `openNow !== true` 인 곳이 빠진 결과를 "거르지 않은 결과" 라고 부르게 된다.
 */
const NO_FILTERS: FacilityFilters = { ...DEFAULT_FACILITY_FILTERS, openNowOnly: false }

describe('applyFilters — 거르기만 하고 정렬을 건드리지 않는다', () => {
  it('조건이 없으면 서버 순서 그대로다', () => {
    expect(applyFilters(ALL, NO_FILTERS)).toEqual(ALL)
  })

  it('24시간을 위로 올려 재정렬하지 않는다 — "가까운 순" 과 어긋난다', () => {
    const result = applyFilters(ALL, NO_FILTERS)

    expect(result.map((f) => f.distanceMeters)).toEqual([500, 1200, 3100, 4400])
  })

  it('유형으로 거른다', () => {
    const result = applyFilters(ALL, { ...NO_FILTERS, type: 'ANIMAL_PHARMACY' })

    expect(result).toEqual([PHARMACY_CLOSED])
  })

  it('24시간으로 거른다', () => {
    expect(applyFilters(ALL, { ...NO_FILTERS, open24Only: true })).toEqual([HOSPITAL_24])
  })

  /**
   * `openNow === null` 은 "닫힘" 이 아니라 "판정할 수 없음" 이다. 그래도 "지금 진료중" 에는
   * 넣지 않는다 — 그 토글은 확인된 곳만 보겠다는 뜻이고, 넣으면 약속을 지키지 못한다.
   */
  it('"지금 진료중" 은 openNow 가 true 인 곳만 남긴다 — null 은 넣지 않는다', () => {
    const result = applyFilters(ALL, { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true })

    expect(result).toEqual([HOSPITAL_24, HOSPITAL_OPEN])
    expect(result).not.toContain(HOSPITAL_UNKNOWN)
  })

  it('조건을 겹쳐 쓰면 모두 만족하는 것만 남는다', () => {
    const result = applyFilters(ALL, {
      ...DEFAULT_FACILITY_FILTERS,
      type: 'ANIMAL_HOSPITAL',
      open24Only: true,
      openNowOnly: true,
    })

    expect(result).toEqual([HOSPITAL_24])
  })
})

describe('facilityCounts — 칩 개수는 그 칩만 눌렀을 때의 수다', () => {
  it('유형·24시간·지금진료중을 각각 센다', () => {
    const counts = facilityCounts(ALL)

    expect(counts.all).toBe(4)
    expect(counts.byType.ANIMAL_HOSPITAL).toBe(3)
    expect(counts.byType.ANIMAL_PHARMACY).toBe(1)
    expect(counts.open24).toBe(1)
    // openNow === null 은 세지 않는다
    expect(counts.openNow).toBe(2)
  })

  it('0 을 감추지 않는다', () => {
    expect(facilityCounts([HOSPITAL_UNKNOWN]).openNow).toBe(0)
  })
})

describe('countsAreComplete — 잘린 목록에서 센 개수는 전체가 아니다', () => {
  const result = {
    facilities: ALL,
    radius: 10_000,
    open24Only: false,
    providerName: '한국문화정보원',
  }

  it('다 받았으면 개수를 쓴다', () => {
    expect(countsAreComplete({ ...result, totalCount: ALL.length })).toBe(true)
  })

  /*
    **#297.** `totalCount` 가 자르기 전 총계가 됐으므로(BE #285 / PR #296) 잘림을
    정직하게 판정한다 — 받은 개수가 총계보다 적으면 반경 안에 더 있다.
  */
  it('총계보다 적게 받았으면 개수를 쓰지 않는다 — 틀린 개수는 없는 개수보다 나쁘다', () => {
    expect(countsAreComplete({ ...result, totalCount: 136 })).toBe(false)
  })

  /*
    **상한 도달 우회(#281)를 걷은 것이 여기서 드러난다.** 반경 안 총계가 정확히 상한과
    같으면 다 받은 것이고 개수는 옳다. 우회는 이 응답을 잘린 것으로 오판해 숫자를 뺐다.
  */
  it('상한만큼 왔는데 총계도 그만큼이면 개수를 쓴다', () => {
    const full = Array.from({ length: MAX_SIZE }, (_, index) =>
      facility({ facilityId: String(index) }),
    )

    expect(countsAreComplete({ ...result, facilities: full, totalCount: MAX_SIZE })).toBe(true)
  })

  /*
    반대 방향 — 상한까지 받았는데도 총계가 더 크면 진짜로 잘렸다. 제주 전역이 214곳이라
    (dev 실측) 250 상한에서는 실제로 일어나지 않지만, 반경 안 시설이 250을 넘으면 이
    갈래가 화면을 지킨다.
  */
  it('상한까지 받았어도 총계가 더 크면 개수를 쓰지 않는다', () => {
    const full = Array.from({ length: MAX_SIZE }, (_, index) =>
      facility({ facilityId: String(index) }),
    )

    expect(countsAreComplete({ ...result, facilities: full, totalCount: MAX_SIZE + 1 })).toBe(false)
  })
})

describe('reliefs — 무엇을 끄면 몇 개가 되는지 실제로 센다', () => {
  it('켜지 않은 조건은 제안하지 않는다', () => {
    expect(reliefs(ALL, NO_FILTERS)).toEqual([])
  })

  it('끈 뒤의 개수를 세어 준다', () => {
    const result = reliefs(ALL, { ...NO_FILTERS, openNowOnly: true })

    expect(result).toHaveLength(1)
    expect(result[0]?.kind).toBe('openNowOnly')
    expect(result[0]?.count).toBe(4)
  })

  it('여러 조건이 켜져 있으면 각각의 경로를 준다', () => {
    const result = reliefs(ALL, {
      ...NO_FILTERS,
      type: 'ANIMAL_PHARMACY',
      open24Only: false,
      openNowOnly: true,
    })

    expect(result.map((r) => r.kind)).toEqual(['openNowOnly', 'type'])
    // 약국을 유지한 채 "지금 진료중" 만 끄면 1곳
    expect(result[0]?.count).toBe(1)
    // "지금 진료중" 을 유지한 채 유형을 전체로 바꾸면 2곳
    expect(result[1]?.count).toBe(2)
  })

  it('꺼도 여전히 0 이면 제안하지 않는다 — 눌러도 달라지지 않는 버튼을 주지 않는다', () => {
    const onlyUnknown = [HOSPITAL_UNKNOWN]
    const result = reliefs(onlyUnknown, {
      ...DEFAULT_FACILITY_FILTERS,
      type: 'ANIMAL_PHARMACY',
      openNowOnly: true,
    })

    expect(result).toEqual([])
  })
})

/**
 * 시설명 · 주소 검색 (#584). **서버가 아니라 화면이 좁힌다** — 이 화면은 이미 반경 안
 * 전량을 받아 다른 축도 화면에서 거른다 (`matchesKeyword` 머리주석).
 */
const HALLA = facility({
  facilityId: '10',
  name: '한라동물메디컬센터',
  addr: '제주특별자치도 서귀포시 중앙로 12',
})
const YEONDONG = facility({
  facilityId: '11',
  name: '연동24시동물병원',
  addr: '제주특별자치도 제주시 연동 1길',
})
const VET_LATIN = facility({
  facilityId: '12',
  name: 'HAPPY Vet Clinic',
  addr: '제주특별자치도 제주시 노형로 3',
})

const SEARCHABLE = [HALLA, YEONDONG, VET_LATIN]

describe('matchesKeyword — 이름과 주소를 한 건초더미로 본다', () => {
  it('검색어가 없으면 전부 통과한다', () => {
    expect(SEARCHABLE.every((f) => matchesKeyword(f, null))).toBe(true)
  })

  it('이름의 일부로 찾는다', () => {
    expect(matchesKeyword(HALLA, '한라')).toBe(true)
    expect(matchesKeyword(YEONDONG, '한라')).toBe(false)
  })

  it('주소의 일부로도 찾는다', () => {
    expect(matchesKeyword(HALLA, '서귀포')).toBe(true)
    expect(matchesKeyword(YEONDONG, '서귀포')).toBe(false)
  })

  /*
    통짜 부분문자열로 보면 이름과 주소를 걸친 말이 아무것도 못 찾는다 — 사용자가 아는
    두 낱말을 붙여 쓸 이유가 없다.
  */
  it('공백으로 끊은 낱말을 전부 만족해야 한다 — 이름과 주소에 나뉘어 있어도 찾는다', () => {
    expect(matchesKeyword(HALLA, '한라 서귀포')).toBe(true)
    expect(matchesKeyword(HALLA, '한라 제주시')).toBe(false)
  })

  it('낱말 순서는 보지 않는다', () => {
    expect(matchesKeyword(HALLA, '서귀포 한라')).toBe(true)
  })

  it('대소문자를 무시한다 — 주소·이름에 로마자가 섞인 곳이 있다', () => {
    expect(matchesKeyword(VET_LATIN, 'happy vet')).toBe(true)
    expect(matchesKeyword(VET_LATIN, 'HAPPY')).toBe(true)
  })
})

describe('narrowByKeyword — 개수를 세기 전에 통과시키는 범위', () => {
  it('검색어가 없으면 배열을 그대로 돌려준다', () => {
    expect(narrowByKeyword(SEARCHABLE, null)).toEqual(SEARCHABLE)
  })

  it('검색어에 맞는 것만 남기고 순서를 지킨다', () => {
    expect(narrowByKeyword(SEARCHABLE, '제주시').map((f) => f.facilityId)).toEqual(['11', '12'])
  })
})

describe('검색어와 다른 축이 함께 걸릴 때', () => {
  const MIXED = [
    HALLA,
    YEONDONG,
    facility({
      facilityId: '13',
      facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
      name: '한라동물약국',
      addr: '제주특별자치도 서귀포시 중앙로 20',
    }),
  ]

  it('applyFilters 는 검색어도 함께 만족하는 것만 남긴다', () => {
    const result = applyFilters(MIXED, {
      ...DEFAULT_FACILITY_FILTERS,
      type: 'ANIMAL_HOSPITAL',
      keyword: '한라',
    })

    expect(result.map((f) => f.facilityId)).toEqual(['10'])
  })

  /*
    **칩 개수는 검색어를 적용한 뒤에 센다** — 세는 배열을 부르는 쪽이 `narrowByKeyword`
    로 좁혀 넘기기 때문이다. 검색 중인데 칩이 반경 전량의 수를 말하면 눌러서 나오는
    결과와 어긋난다 (`facilityCounts` 머리주석).
  */
  it('검색어로 좁힌 배열을 세면 칩 개수가 검색 범위를 따른다', () => {
    const counts = facilityCounts(narrowByKeyword(MIXED, '한라'))

    expect(counts.all).toBe(2)
    expect(counts.byType.ANIMAL_HOSPITAL).toBe(1)
    expect(counts.byType.ANIMAL_PHARMACY).toBe(1)
  })

  it('검색어가 0건을 만들면 검색어를 지우는 완화안을 준다', () => {
    const result = reliefs(MIXED, { ...DEFAULT_FACILITY_FILTERS, keyword: '없는이름ZZZ' })

    expect(result.map((r) => r.kind)).toEqual(['keyword'])
    expect(result[0]?.count).toBe(3)
    expect(result[0]?.next.keyword).toBeNull()
  })

  /* 검색어는 사용자가 직접 친 말이라 가장 버리기 아깝다 — 칩을 끄는 쪽을 먼저 제안한다 */
  it('칩과 검색어가 함께 걸리면 검색어 완화안이 맨 뒤다', () => {
    const result = reliefs(MIXED, {
      ...DEFAULT_FACILITY_FILTERS,
      type: 'ANIMAL_PHARMACY',
      keyword: '연동',
    })

    expect(result.map((r) => r.kind)).toEqual(['type', 'keyword'])
  })
})
