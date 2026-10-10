import { describe, expect, it } from 'vitest'

import {
  facilityPinIcon,
  facilityPinId,
  readFacilityPinId,
  toFacilityPin,
} from '@/lib/emergency/facility-pin'
import { pinShape } from '@/lib/map/pin-content'
import { facility, pharmacy } from '@/test/fixtures/emergency'

/** 긴급 시설 → 지도 핀 (#1286 D2-2 · D3-3) */
describe('facilityPinIcon', () => {
  it('병원은 십자 · 약국은 알약이다 — code 로 고른다', () => {
    expect(facilityPinIcon('ANIMAL_HOSPITAL')).toBe('cross')
    expect(facilityPinIcon('ANIMAL_PHARMACY')).toBe('pill')
  })

  it('모르는 코드는 범용 핀이다 — 분류를 지어내지 않는다', () => {
    expect(facilityPinIcon('ANIMAL_SHELTER')).toBe('pin')
    expect(facilityPinIcon('constructor')).toBe('pin')
    // 한국어 name 으로 고르지 않는다
    expect(facilityPinIcon('동물병원')).toBe('pin')
  })
})

describe('facilityPinId · readFacilityPinId', () => {
  it('왕복한다 — Snowflake 문자열을 그대로 보존한다', () => {
    const id = '4611686018427387904'

    expect(readFacilityPinId(facilityPinId(id))).toBe(id)
    // 숫자로 바꿨다면 정밀도가 깨져 다른 값이 된다
    expect(readFacilityPinId(facilityPinId(id))).not.toBe(String(Number(id)))
  })

  it('장소 id(숫자 문자열)는 시설이 아니다', () => {
    expect(readFacilityPinId('126508')).toBeNull()
    expect(readFacilityPinId('')).toBeNull()
  })

  it('앞머리만 있는 id 는 시설이 아니다', () => {
    expect(readFacilityPinId(facilityPinId(''))).toBeNull()
  })
})

describe('toFacilityPin', () => {
  it('사각 + 십자 · 이름 · 좌표를 옮긴다', () => {
    const item = facility()
    const pin = toFacilityPin(item, { id: facilityPinId(item.facilityId), caption: null })

    expect(pin).toEqual({
      id: `facility:${item.facilityId}`,
      title: item.name,
      lat: item.lat,
      lng: item.lng,
      caption: null,
      muted: false,
      icon: 'cross',
      shape: 'square',
    })
    expect(pinShape(pin)).toBe('square')
  })

  it('약국만 낮춤 채움이다', () => {
    expect(toFacilityPin(pharmacy(), { id: 'p', caption: null }).muted).toBe(true)
    expect(toFacilityPin(pharmacy(), { id: 'p', caption: null }).icon).toBe('pill')
    expect(toFacilityPin(facility(), { id: 'h', caption: null }).muted).toBe(false)
  })

  it('id · 캡션은 화면이 정한다 — /emergency 는 facilityId 와 거리', () => {
    const item = facility()
    const pin = toFacilityPin(item, { id: item.facilityId, caption: '480m' })

    expect(pin.id).toBe(item.facilityId)
    expect(pin.caption).toBe('480m')
  })
})
