import { describe, expect, it } from 'vitest'

import {
  applyFilters,
  countsAreComplete,
  facilityCounts,
  reliefs,
} from '@/features/emergency/facility-filters'
import { DEFAULT_FACILITY_FILTERS, type NearbyFacilityItem } from '@/types/emergency'

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

describe('applyFilters — 거르기만 하고 정렬을 건드리지 않는다', () => {
  it('조건이 없으면 서버 순서 그대로다', () => {
    expect(applyFilters(ALL, DEFAULT_FACILITY_FILTERS)).toEqual(ALL)
  })

  it('24시간을 위로 올려 재정렬하지 않는다 — "가까운 순" 과 어긋난다', () => {
    const result = applyFilters(ALL, DEFAULT_FACILITY_FILTERS)

    expect(result.map((f) => f.distanceMeters)).toEqual([500, 1200, 3100, 4400])
  })

  it('유형으로 거른다', () => {
    const result = applyFilters(ALL, { ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_PHARMACY' })

    expect(result).toEqual([PHARMACY_CLOSED])
  })

  it('24시간으로 거른다', () => {
    expect(applyFilters(ALL, { ...DEFAULT_FACILITY_FILTERS, open24Only: true })).toEqual([
      HOSPITAL_24,
    ])
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
    expect(countsAreComplete({ ...result, totalCount: 4 })).toBe(true)
  })

  it('size 상한에 걸려 잘렸으면 쓰지 않는다 — 틀린 개수는 없는 개수보다 나쁘다', () => {
    expect(countsAreComplete({ ...result, totalCount: 120 })).toBe(false)
  })
})

describe('reliefs — 무엇을 끄면 몇 개가 되는지 실제로 센다', () => {
  it('켜지 않은 조건은 제안하지 않는다', () => {
    expect(reliefs(ALL, DEFAULT_FACILITY_FILTERS)).toEqual([])
  })

  it('끈 뒤의 개수를 세어 준다', () => {
    const result = reliefs(ALL, { ...DEFAULT_FACILITY_FILTERS, openNowOnly: true })

    expect(result).toHaveLength(1)
    expect(result[0]?.kind).toBe('openNowOnly')
    expect(result[0]?.count).toBe(4)
  })

  it('여러 조건이 켜져 있으면 각각의 경로를 준다', () => {
    const result = reliefs(ALL, {
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
