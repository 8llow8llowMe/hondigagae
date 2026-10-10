import { describe, expect, it } from 'vitest'

import { collectIndoorAlternatives } from '@/lib/insight/indoor'
import { suitability, suitabilityWithIndoor } from '@/test/fixtures/insight'
import type { AlternativePlaceItem, PlaceSuitabilityResponse } from '@/types/insight'

const ALTERNATIVE = suitabilityWithIndoor.indoorAlternatives[0] as AlternativePlaceItem

function alternative(overrides: Partial<AlternativePlaceItem> = {}): AlternativePlaceItem {
  return { ...ALTERNATIVE, ...overrides }
}

function withAlternatives(
  placeId: string,
  alternatives: AlternativePlaceItem[],
): PlaceSuitabilityResponse {
  return { ...suitability, placeId, indoorAlternatives: alternatives }
}

describe('collectIndoorAlternatives', () => {
  it('비 예보가 아니면 빈 배열이다 — 섹션이 뜨지 않는다', () => {
    expect(collectIndoorAlternatives([suitability], [], 3)).toEqual([])
  })

  /* 서로 가까운 장소들이 같은 실내를 가리킨다. 접지 않으면 같은 미술관이 세 번 뜬다 */
  it('여러 응답에 겹쳐 온 같은 대안을 한 번만 세운다', () => {
    const collected = collectIndoorAlternatives(
      [
        withAlternatives('a', [alternative({ placeId: 'x', distanceMeters: 3000 })]),
        withAlternatives('b', [alternative({ placeId: 'x', distanceMeters: 900 })]),
      ],
      [],
      3,
    )

    expect(collected).toHaveLength(1)
  })

  /* 응답마다 기준 장소가 다르다. 먼 기준의 값을 남기면 화면이 실제보다 멀다고 말한다 */
  it('겹치는 대안은 가장 가까운 거리를 남긴다', () => {
    const collected = collectIndoorAlternatives(
      [
        withAlternatives('a', [alternative({ placeId: 'x', distanceMeters: 3000 })]),
        withAlternatives('b', [alternative({ placeId: 'x', distanceMeters: 900 })]),
      ],
      [],
      3,
    )

    expect(collected[0]?.distanceMeters).toBe(900)
  })

  it('가까운 순으로 정렬한다', () => {
    const collected = collectIndoorAlternatives(
      [
        withAlternatives('a', [
          alternative({ placeId: 'far', distanceMeters: 5000 }),
          alternative({ placeId: 'near', distanceMeters: 400 }),
        ]),
      ],
      [],
      3,
    )

    expect(collected.map((item) => item.placeId)).toEqual(['near', 'far'])
  })

  /* 위에서 이미 권한 곳을 아래에서 또 권하면, 같은 화면이 같은 장소를 두 번 말한다 */
  it('이미 목록에 있는 장소는 대안으로 세우지 않는다', () => {
    const collected = collectIndoorAlternatives(
      [withAlternatives('a', [alternative({ placeId: 'shown' }), alternative({ placeId: 'new' })])],
      ['shown'],
      3,
    )

    expect(collected.map((item) => item.placeId)).toEqual(['new'])
  })

  it('limit 을 넘겨 담지 않는다', () => {
    const many = [1, 2, 3, 4, 5].map((n) =>
      alternative({ placeId: `p${n}`, distanceMeters: n * 100 }),
    )

    expect(collectIndoorAlternatives([withAlternatives('a', many)], [], 3)).toHaveLength(3)
  })
})
