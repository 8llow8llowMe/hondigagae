import type { NearbyFacilityItem, NearbyFacilityResult } from '@/types/emergency'

/**
 * 긴급 시설 한 곳. 기본값은 **모든 정보가 갖춰진 병원**이다 —
 * 각 테스트가 없애고 싶은 것만 `null` 로 덮어쓴다.
 */
export function facility(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return {
    facilityId: '4611686018427387904',
    facilityType: { code: 'ANIMAL_HOSPITAL', name: '동물병원', description: null },
    name: '제주24시동물병원',
    addr: '제주특별자치도 제주시 연북로 100',
    lat: 33.48,
    lng: 126.49,
    tel: '064-000-0000',
    operatingHours: '월~금 09:00~19:00, 토 09:00~13:00',
    restDate: '일요일',
    open24: true,
    openNow: true,
    operatingHoursKnown: true,
    distanceMeters: 480,
    ...overrides,
  }
}

/** 약국 — 유형 배지와 마커 톤 낮춤이 걸리는 쪽 */
export function pharmacy(overrides: Partial<NearbyFacilityItem> = {}): NearbyFacilityItem {
  return facility({
    facilityId: '4611686018427387905',
    facilityType: { code: 'ANIMAL_PHARMACY', name: '동물약국', description: null },
    name: '한라동물약국',
    open24: false,
    openNow: false,
    distanceMeters: 1200,
    ...overrides,
  })
}

export function facilityResult(
  overrides: Partial<NearbyFacilityResult> = {},
): NearbyFacilityResult {
  const facilities = overrides.facilities ?? [facility(), pharmacy()]

  return {
    facilities,
    totalCount: facilities.length,
    radius: 10_000,
    open24Only: false,
    providerName: '제주특별자치도',
    ...overrides,
  }
}
