import { describe, expect, it } from 'vitest'

import { draftItemDistances } from '@/lib/ai-plan/draft-distance'
import type { LatLng } from '@/lib/geo/coord'
import { LONG_TRIP_THRESHOLD_M } from '@/lib/geo/distance'
import { aiPlanItem } from '@/test/fixtures/ai-plan'
import type { AiPlanScheduleItem } from '@/types/ai-plan'

/** 협재해수욕장 · 성산일출봉 — 제주 동서 양 끝이라 30km 를 확실히 넘는다 */
const WEST: LatLng = { lat: 33.3938, lng: 126.2396 }
const EAST: LatLng = { lat: 33.4581, lng: 126.9425 }
/** 협재해수욕장에서 걸어갈 만한 거리 */
const NEAR_WEST: LatLng = { lat: 33.3901, lng: 126.2402 }

function item(placeId: string | null, overrides: Partial<AiPlanScheduleItem> = {}) {
  return aiPlanItem({ placeId, ...overrides })
}

/** `placeId` → 좌표. 없는 id 는 좌표를 모르는 항목이다 */
function coordOfMap(entries: [string, LatLng][]) {
  const coords = new Map(entries)
  return (target: AiPlanScheduleItem): LatLng | null =>
    target.placeId === null ? null : (coords.get(target.placeId) ?? null)
}

describe('draftItemDistances — 기준 (이슈 #100)', () => {
  it('첫 항목은 기준이 없어 거리를 내지 않는다', () => {
    const distances = draftItemDistances(
      [item('1'), item('2')],
      coordOfMap([
        ['1', WEST],
        ['2', NEAR_WEST],
      ]),
    )

    expect(distances[0]).toBeNull()
    expect(distances[1]).not.toBeNull()
  })

  it('두 번째부터는 직전 항목 기준이다', () => {
    const [, second] = draftItemDistances(
      [item('1'), item('2')],
      coordOfMap([
        ['1', WEST],
        ['2', NEAR_WEST],
      ]),
    )

    // 약 420m — 1km 미만이라 m 로 표기되는 구간이다
    expect(second).toBeGreaterThan(300)
    expect(second).toBeLessThan(600)
  })

  it('입력과 같은 길이·같은 순서로 돌려준다 — 행과 인덱스로 맞추기 때문이다', () => {
    const items = [item('1'), item(null), item('2')]

    expect(draftItemDistances(items, coordOfMap([['1', WEST]]))).toHaveLength(items.length)
  })
})

describe('draftItemDistances — 좌표를 모르는 항목 (이슈 #100)', () => {
  it('좌표가 없는 항목은 거리를 내지 않는다 — 보강 실패거나 원천에 좌표가 없다', () => {
    // 2번 항목만 좌표를 모른다
    const distances = draftItemDistances(
      [item('1'), item('2'), item('3')],
      coordOfMap([
        ['1', WEST],
        ['3', EAST],
      ]),
    )

    expect(distances).toEqual([null, null, null])
  })

  it('`placeId` 가 null 인 이동 항목은 앞뒤 거리를 끊는다 — 건너뛴 거리를 이동이라 하지 않는다', () => {
    const distances = draftItemDistances(
      [item('1'), item(null, { itemType: 'MOVE' }), item('2')],
      coordOfMap([
        ['1', WEST],
        ['2', NEAR_WEST],
      ]),
    )

    expect(distances).toEqual([null, null, null])
  })

  it('0 을 쓰지 않는다 — 0m 는 "같은 자리" 라 "모른다" 와 다르다', () => {
    const [, second] = draftItemDistances([item('1'), item('2')], coordOfMap([['1', WEST]]))

    expect(second).toBeNull()
    expect(second).not.toBe(0)
  })
})

describe('draftItemDistances — 긴 이동 (이슈 #100)', () => {
  it('제주 동서 횡단은 임계값(30km)을 넘는다', () => {
    const [, second] = draftItemDistances(
      [item('1'), item('2')],
      coordOfMap([
        ['1', WEST],
        ['2', EAST],
      ]),
    )

    expect(second).not.toBeNull()
    expect(second as number).toBeGreaterThan(LONG_TRIP_THRESHOLD_M)
  })

  it('같은 임계값을 일정 상세와 공유한다 — 화면마다 숫자를 두지 않는다', () => {
    expect(LONG_TRIP_THRESHOLD_M).toBe(30_000)
  })
})
