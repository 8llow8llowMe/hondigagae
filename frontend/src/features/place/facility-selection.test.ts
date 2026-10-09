import { describe, expect, it } from 'vitest'

import {
  facilityLayerFacilities,
  pickedFacility,
  placeTakesOverFacility,
} from '@/features/place/facility-selection'
import { facility, facilityResult, pharmacy } from '@/test/fixtures/emergency'

/** 병원 · 약국 층의 시설 목록 · 고른 시설 파생 (#1286 리뷰 6 · 3 · 5) */
describe('facilityLayerFacilities', () => {
  it('끄면 직전 응답이 남아 있어도 undefined 다 — 꺼진 층이 이전 응답으로 되살아나지 않는다', () => {
    expect(facilityLayerFacilities({ on: false, data: facilityResult() })).toBeUndefined()
  })

  it('켜고 받기 전에는 undefined 다', () => {
    expect(facilityLayerFacilities({ on: true, data: undefined })).toBeUndefined()
  })

  it('켜고 받았으면 응답의 시설 그대로다', () => {
    const data = facilityResult({ facilities: [facility(), pharmacy()] })

    expect(facilityLayerFacilities({ on: true, data })).toBe(data.facilities)
  })
})

describe('pickedFacility', () => {
  const facilities = [facility({ facilityId: '1' }), pharmacy({ facilityId: '2' })]

  it('고른 것이 없으면 시설도 없고 비울 것도 없다', () => {
    expect(pickedFacility({ picked: null, facilities })).toEqual({ facility: null, gone: false })
  })

  it('최신 응답에서 id 로 찾는다 — facilityId 는 문자열 그대로 비교한다', () => {
    expect(pickedFacility({ picked: '2', facilities })).toEqual({
      facility: facilities[1],
      gone: false,
    })
  })

  it('응답에서 빠졌으면 gone 이다 — 호출부가 고른 id 를 비워 나중 응답에 되살아나지 않게 한다', () => {
    expect(pickedFacility({ picked: '9', facilities })).toEqual({ facility: null, gone: true })
  })

  it('아직 받기 전(또는 꺼짐)이면 gone 이 아니다 — 판단할 응답이 없다', () => {
    expect(pickedFacility({ picked: '1', facilities: undefined })).toEqual({
      facility: null,
      gone: false,
    })
  })
})

describe('placeTakesOverFacility', () => {
  it('URL 의 장소 선택이 다른 장소로 바뀌면 시설 선택을 비운다 — 브라우저 앞으로 가기', () => {
    expect(placeTakesOverFacility(null, '101')).toBe(true)
    expect(placeTakesOverFacility('101', '202')).toBe(true)
  })

  it('장소 선택이 사라지는 것(시설로 갈아탈 때의 history.back)은 시설을 건드리지 않는다', () => {
    expect(placeTakesOverFacility('101', null)).toBe(false)
  })

  it('바뀌지 않았으면 그대로다', () => {
    expect(placeTakesOverFacility('101', '101')).toBe(false)
    expect(placeTakesOverFacility(null, null)).toBe(false)
  })
})
