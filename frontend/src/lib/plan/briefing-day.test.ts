import { describe, expect, it } from 'vitest'

import { basisItemId, nextDestination, toPlanRouteModel } from '@/lib/plan/briefing-day'
import { planItem, planItemPlace } from '@/test/fixtures/plan'

const LODGING = { code: 'LODGING', name: '숙박', description: null }
const MOVE = { code: 'MOVE', name: '이동', description: null }

const a = planItem({ planItemId: 'a', day: 1, sequence: 0, targetId: 'P1', title: '중문' })
const b = planItem({ planItemId: 'b', day: 1, sequence: 1, targetId: 'P2', title: '식당' })
const noCoord = planItem({ planItemId: 'c', day: 1, sequence: 2, targetId: 'P3', place: null })
const move = planItem({
  planItemId: 'm',
  day: 1,
  sequence: 3,
  itemType: MOVE,
  targetId: null,
  place: null,
})
const lodging = planItem({
  planItemId: 'l',
  day: 1,
  sequence: 4,
  itemType: LODGING,
  targetId: 'P1',
})

describe('basisItemId', () => {
  it('PLACE 항목의 targetId 가 대표 장소 id 와 같은 첫 항목', () => {
    expect(basisItemId([a, b], 'P2')).toBe('b')
  })
  it('같은 장소가 두 번이면 첫 항목 하나', () => {
    const again = planItem({ planItemId: 'a2', day: 1, sequence: 5, targetId: 'P1' })
    expect(basisItemId([a, again], 'P1')).toBe('a')
  })
  it('PLACE 가 아닌 항목(숙박)의 targetId 는 보지 않는다', () => {
    expect(basisItemId([lodging], 'P1')).toBeNull()
  })
  it('대표 장소가 없거나 맞는 항목이 없으면 null', () => {
    expect(basisItemId([a], null)).toBeNull()
    expect(basisItemId([a], 'NOPE')).toBeNull()
  })
})

describe('nextDestination', () => {
  it('내일(EVE)은 좌표 있는 첫 항목 — 다녀옴 여부를 보지 않는다', () => {
    expect(nextDestination([noCoord, { ...a, visited: true }, b], 'EVE')?.planItemId).toBe('a')
  })
  it('오늘(TODAY)은 좌표 있고 아직 안 간 첫 항목', () => {
    expect(nextDestination([{ ...a, visited: true }, noCoord, b], 'TODAY')?.planItemId).toBe('b')
  })
  it('오늘 전부 다녀왔으면 null', () => {
    expect(
      nextDestination(
        [
          { ...a, visited: true },
          { ...b, visited: true },
        ],
        'TODAY',
      ),
    ).toBeNull()
  })
  it('좌표 있는 항목이 없으면 null', () => {
    expect(nextDestination([noCoord, move], 'EVE')).toBeNull()
  })
})

describe('toPlanRouteModel', () => {
  it('좌표 있는 항목만 번호를 받고, 좌표 없는 장소는 omitted 로 센다 — 이동은 세지 않는다', () => {
    const model = toPlanRouteModel([a, noCoord, move, b], null)
    expect(model.stops.map((stop) => [stop.id, stop.order])).toEqual([
      ['a', 1],
      ['b', 2],
    ])
    expect(model.omittedCount).toBe(1)
  })
  it('전날 숙소가 있으면 첫 정류점으로 가는 점선 구간이 붙는다', () => {
    const prev = planItem({
      planItemId: 'prev',
      day: 0,
      sequence: 9,
      itemType: LODGING,
      place: planItemPlace({ lat: 33.3, lng: 126.3 }),
    })
    expect(toPlanRouteModel([a], prev).legs[0]?.fromLodging).toBe(true)
  })
})
