import { describe, expect, it } from 'vitest'

import { draftDayStartTimes, travelMinutes } from '@/lib/ai-plan/draft-schedule'
import type { LatLng } from '@/lib/geo/coord'

/**
 * AI 초안을 담을 때 채우는 시각 — 이슈 #1424.
 *
 * 예전에는 매일 같은 고정 슬롯(10:00 / 12:30 / 15:00)이었다. 이제 앞 항목 시각 + 머무는 시간 +
 * 직선거리 기반 이동 시간으로 이어 붙인다.
 */

/** 위도 1도 ≈ 111.2km. 경도를 고정하고 위도만 움직여 거리를 만든다 */
const ORIGIN: LatLng = { lat: 33.3, lng: 126.5 }
function north(km: number): LatLng {
  return { lat: ORIGIN.lat + km / 111.195, lng: ORIGIN.lng }
}

function entry(itemType: string, placeId: string | null = null) {
  return { itemType, placeId }
}

describe('travelMinutes — 직선거리 기반 이동 시간', () => {
  it('직선 12km 는 30분, 20km 는 40분이다 (우회 1.3배 · 시속 40km · 10분 단위 올림)', () => {
    expect(travelMinutes(12_000)).toBe(30)
    expect(travelMinutes(20_000)).toBe(40)
  })

  it('아주 가까워도 10분은 잡는다 — 주차 · 걸어서 입장', () => {
    expect(travelMinutes(0)).toBe(10)
    expect(travelMinutes(500)).toBe(10)
  })

  it('좌표를 모르면 30분이다', () => {
    expect(travelMinutes(null)).toBe(30)
  })
})

describe('draftDayStartTimes — 그날 항목 시각', () => {
  it('첫 항목은 10:00, 다음은 앞 시각 + 머무는 시간 + 이동 시간이다', () => {
    const coords = new Map<string, LatLng>([
      ['a', ORIGIN],
      ['b', north(12)],
      ['c', north(32)],
    ])

    // 10:00 → +90(장소) +30(12km) = 12:00 → +60(식사) +40(20km) = 13:40
    expect(
      draftDayStartTimes([entry('PLACE', 'a'), entry('MEAL', 'b'), entry('PLACE', 'c')], coords),
    ).toEqual(['10:00:00', '12:00:00', '13:40:00'])
  })

  it('거리가 다르면 시각도 다르다 — 날마다 같은 템플릿이 아니다', () => {
    const near = new Map<string, LatLng>([
      ['a', ORIGIN],
      ['b', north(1)],
    ])
    const far = new Map<string, LatLng>([
      ['a', ORIGIN],
      ['b', north(20)],
    ])
    const items = [entry('PLACE', 'a'), entry('PLACE', 'b')]

    expect(draftDayStartTimes(items, near)[1]).toBe('11:40:00')
    expect(draftDayStartTimes(items, far)[1]).toBe('12:10:00')
  })

  it('좌표를 모르면 이동 30분으로 이어 붙인다', () => {
    expect(draftDayStartTimes([entry('PLACE', 'x'), entry('PLACE', 'y')])).toEqual([
      '10:00:00',
      '12:00:00',
    ])
  })

  it('이동 항목은 그 자체가 이동이라 이동 시간을 겹쳐 더하지 않는다', () => {
    // 10:00 장소 → 11:30 이동(+90) → 12:00 장소(+30)
    expect(draftDayStartTimes([entry('PLACE', 'a'), entry('MOVE'), entry('PLACE', 'b')])).toEqual([
      '10:00:00',
      '11:30:00',
      '12:00:00',
    ])
  })

  it('숙박은 그날 마지막 일정 뒤다 — 체크인 15:00 보다 이르지 않다', () => {
    expect(draftDayStartTimes([entry('PLACE', 'a'), entry('LODGING', 'l')])).toEqual([
      '10:00:00',
      '15:00:00',
    ])
  })

  it('마지막 일정이 늦으면 숙박은 그 뒤로 밀린다 — 겹치지 않는다', () => {
    const items = [
      entry('PLACE', 'a'),
      entry('PLACE', 'b'),
      entry('PLACE', 'c'),
      entry('LODGING', 'l'),
    ]
    // 10:00 · 12:00 · 14:00 → 숙박 14:00 + 90 + 30 = 16:00
    expect(draftDayStartTimes(items)).toEqual(['10:00:00', '12:00:00', '14:00:00', '16:00:00'])
  })

  it('숙박만 있는 날은 체크인 15:00 이다', () => {
    expect(draftDayStartTimes([entry('LODGING', 'l')])).toEqual(['15:00:00'])
  })

  it('20:00 을 넘으면 그 항목부터 비운다 — 밤늦은 시각을 지어내지 않는다', () => {
    const items = Array.from({ length: 7 }, (_, index) => entry('PLACE', String(index)))
    const times = draftDayStartTimes(items)

    expect(times.slice(0, 6)).toEqual([
      '10:00:00',
      '12:00:00',
      '14:00:00',
      '16:00:00',
      '18:00:00',
      '20:00:00',
    ])
    expect(times[6]).toBeUndefined()
  })

  it('시각은 언제나 순서대로 흐른다 — 역행하지 않는다', () => {
    const coords = new Map<string, LatLng>([
      ['a', ORIGIN],
      ['b', north(40)],
      ['c', north(2)],
    ])
    const times = draftDayStartTimes(
      [entry('PLACE', 'a'), entry('PLACE', 'b'), entry('MEAL', 'c'), entry('LODGING', 'a')],
      coords,
    ).filter((time): time is string => time !== undefined)

    expect([...times].sort()).toEqual(times)
    expect(new Set(times).size).toBe(times.length)
  })
})
