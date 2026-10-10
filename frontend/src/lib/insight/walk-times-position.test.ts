import { describe, expect, it } from 'vitest'

import { JEJU_QUERY_CENTER, type PositionResult } from '@/lib/geo/current-position'
import { walkTimesBasis, walkTimesQueryPosition } from '@/lib/insight/walk-times-position'

const granted: PositionResult = { kind: 'granted', lat: 33.25, lng: 126.56 }
const fallback: PositionResult = { ...JEJU_QUERY_CENTER, kind: 'fallback', reason: 'unasked' }

describe('walkTimesQueryPosition (#1142)', () => {
  it('위치를 알기 전에도 제주 중심으로 조회한다 — 서버가 미리 받은 캐시와 같은 좌표', () => {
    expect(walkTimesQueryPosition(null)).toEqual(JEJU_QUERY_CENTER)
  })

  it('폴백도 같은 좌표 — 비로그인 첫 화면은 다시 받지 않는다', () => {
    expect(walkTimesQueryPosition(fallback)).toEqual(walkTimesQueryPosition(null))
  })

  it('허용되면 현재 위치', () => {
    expect(walkTimesQueryPosition(granted)).toEqual({ lat: 33.25, lng: 126.56 })
  })
})

describe('walkTimesBasis — 보이는 데이터의 좌표를 말한다', () => {
  it.each([
    ['위치 판정 전', null, false, 'jeju'],
    ['폴백', fallback, false, 'jeju'],
    ['허용 · 현재 위치 데이터 도착', granted, false, 'current'],
    ['허용 · 아직 제주 데이터를 자리채움으로 보이는 중', granted, true, 'jeju'],
  ] as const)('%s → %s', (_, position, placeholder, expected) => {
    expect(walkTimesBasis(position, placeholder)).toBe(expected)
  })
})
