import { describe, expect, it } from 'vitest'

import { hospitalBannerDescription, pickNearestHospital } from '@/lib/emergency/nearest'
import { messages } from '@/lib/messages'
import type { NearbyFacilityItem, NearbyFacilityResult } from '@/types/emergency'

function facility(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return {
    facilityId: '4611686018427387904',
    facilityType: { code: 'ANIMAL_HOSPITAL', name: '동물병원', description: null },
    name: '제주동물병원',
    addr: '제주특별자치도 제주시 연북로 100',
    lat: 33.4863,
    lng: 126.4983,
    tel: '064-000-0000',
    operatingHours: '09:00~19:00',
    restDate: null,
    open24: false,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 1000,
    ...overrides,
  }
}

function result(facilities: NearbyFacilityItem[]): NearbyFacilityResult {
  return {
    facilities,
    totalCount: facilities.length,
    radius: 10_000,
    open24Only: false,
    providerName: '한국문화정보원',
  }
}

describe('pickNearestHospital', () => {
  it('24시간 병원이 있으면 그중 가장 가까운 곳을 고른다', () => {
    const picked = pickNearestHospital(
      result([
        facility({ name: '가까운 주간병원', distanceMeters: 300 }),
        facility({ name: '먼 24시', open24: true, distanceMeters: 4000 }),
        facility({ name: '가까운 24시', open24: true, distanceMeters: 1200 }),
      ]),
    )

    expect(picked?.facility.name).toBe('가까운 24시')
    expect(picked?.kind).toBe('open24')
  })

  it('24시간이 없으면 지금 진료중인 곳으로 내려온다', () => {
    const picked = pickNearestHospital(
      result([
        facility({ name: '닫힘', openNow: false, distanceMeters: 200 }),
        facility({ name: '진료중', openNow: true, distanceMeters: 900 }),
      ]),
    )

    expect(picked?.facility.name).toBe('진료중')
    expect(picked?.kind).toBe('openNow')
  })

  /*
    **`openNow === null` 은 "닫힘" 이 아니라 "판정할 수 없음" 이다.** 이것을 진료중으로
    치면 급할 때 헛걸음시킨다 — 배지 3상태를 나눠 둔 이유와 같은 판단이다.
  */
  it('영업시간을 모르는 곳을 "지금 진료중" 이라고 부르지 않는다', () => {
    const picked = pickNearestHospital(
      result([
        facility({
          name: '시간 미상',
          openNow: null,
          operatingHoursKnown: false,
          distanceMeters: 100,
        }),
      ]),
    )

    expect(picked?.kind).toBe('nearest')
  })

  it('전부 닫혀 있어도 가장 가까운 곳은 알려 준다', () => {
    const picked = pickNearestHospital(
      result([
        facility({ name: '먼 곳', openNow: false, distanceMeters: 5000 }),
        facility({ name: '가까운 곳', openNow: false, distanceMeters: 800 }),
      ]),
    )

    expect(picked?.facility.name).toBe('가까운 곳')
    expect(picked?.kind).toBe('nearest')
  })

  /* 배너 제목이 "주변 동물병원 찾기" 다. 약국을 골라 두면 제목과 다른 것을 말한다 */
  it('약국을 병원 자리에 세우지 않는다', () => {
    const picked = pickNearestHospital(
      result([
        facility({
          name: '가까운 약국',
          facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
          distanceMeters: 100,
        }),
        facility({ name: '먼 병원', distanceMeters: 3000 }),
      ]),
    )

    expect(picked?.facility.name).toBe('먼 병원')
  })

  it('병원이 하나도 없거나 아직 조회 전이면 null 이다', () => {
    expect(pickNearestHospital(result([]))).toBeNull()
    expect(pickNearestHospital(null)).toBeNull()
    expect(pickNearestHospital(undefined)).toBeNull()
  })

  /* 정렬을 믿고 [0] 을 집으면, 서버가 정렬을 바꾸는 날 조용히 틀린 답이 나간다 */
  it('응답이 가까운 순으로 오지 않아도 최솟값을 고른다', () => {
    const picked = pickNearestHospital(
      result([
        facility({ name: '먼 곳', distanceMeters: 9000 }),
        facility({ name: '가까운 곳', distanceMeters: 120 }),
      ]),
    )

    expect(picked?.facility.name).toBe('가까운 곳')
  })
})

describe('hospitalBannerDescription', () => {
  /*
    좌표 미허용 · 조회 전 · 실패 · 반경 안에 병원 없음이 모두 이 갈래다. 배너는 어떤
    상태에서도 사라지지 않으므로(`components/banner.tsx`) 문구가 반드시 있어야 한다.
  */
  it('찾지 못하면 지금까지의 고정 문구로 남는다', () => {
    expect(hospitalBannerDescription(null)).toBe(messages.home.emergencyDesc)
  })

  it('24시간이면 그것을 먼저 말한다', () => {
    const note = hospitalBannerDescription({
      facility: facility({ name: '제주24시동물병원', open24: true, distanceMeters: 480 }),
      kind: 'open24',
    })

    expect(note).toBe('24시간 · 제주24시동물병원 480m')
  })

  it('지금 진료중이면 그것을 말한다', () => {
    const note = hospitalBannerDescription({
      facility: facility({ name: '한라동물병원', distanceMeters: 1250 }),
      kind: 'openNow',
    })

    expect(note).toBe('지금 진료중 · 한라동물병원 1.3km')
  })

  /* `openNow === null` 이 이 갈래다 — 열림/닫힘을 단정하지 않고 위치만 말한다 */
  it('영업 여부를 모르면 단정하지 않고 위치만 말한다', () => {
    const note = hospitalBannerDescription({
      facility: facility({ name: '서귀포동물병원', openNow: null, distanceMeters: 3120 }),
      kind: 'nearest',
    })

    expect(note).toBe('가장 가까운 곳 · 서귀포동물병원 3.1km')
    expect(note).not.toContain('진료중')
  })

  /*
    #206 회귀 감시. 예전에는 홈이 "3곳" 을 박아 두고 목록은 "반경 안에 없어요" 라고
    말했다. 어느 갈래에서도 개수를 세지 않는다.
  */
  it('어느 갈래에서도 개수를 말하지 않는다', () => {
    const notes = (['open24', 'openNow', 'nearest'] as const).map((kind) =>
      hospitalBannerDescription({ facility: facility(), kind }),
    )

    for (const note of [...notes, hospitalBannerDescription(null)]) {
      expect(note).not.toMatch(/\d+\s*곳/)
    }
  })
})
