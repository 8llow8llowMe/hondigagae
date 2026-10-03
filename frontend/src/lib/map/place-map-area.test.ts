import { describe, expect, it } from 'vitest'

import {
  areaAfterIdle,
  areaAfterResearch,
  INITIAL_PLACE_MAP_AREA,
  placesInArea,
} from '@/lib/map/place-map-area'
import type { MapBounds } from '@/lib/map/viewport'

/*
  `/places` 지도 보기의 **두 영역** — 이슈 #1143.

  첫 `idle` 이 목록 영역 필터를 켜면 서버 렌더·첫 페인트에 선 행이 SDK 가 뜨는 순간 빠져
  아래 행이 당겨졌다 (Lighthouse 모바일 CLS 0.159, 범인 요소가 시트 행). 그래서 첫 영역은
  **재검색 권유의 기준**으로만 쓰고, 목록을 거르는 영역은 재검색 버튼만 놓는다.
*/

/** 제주시 쪽 — 첫 화면 레벨 9 모바일 폭 언저리 */
const FIRST: MapBounds = { sw: { lat: 33.4, lng: 126.4 }, ne: { lat: 33.6, lng: 126.65 } }
/** 서귀포 쪽 — 사용자가 옮겨 간 자리 */
const MOVED: MapBounds = { sw: { lat: 33.2, lng: 126.45 }, ne: { lat: 33.3, lng: 126.6 } }

describe('areaAfterIdle', () => {
  it('첫 idle 은 권유 기준만 놓고 목록 필터 영역은 비워 둔다', () => {
    const area = areaAfterIdle(INITIAL_PLACE_MAP_AREA, FIRST, false)

    expect(area.origin).toEqual(FIRST)
    // 채우면 첫 페인트의 행이 SDK 로드 순간 빠진다 — #1143 의 원인 그 자체다
    expect(area.searched).toBeNull()
  })

  it('사용자 이동 idle 은 아무 영역도 옮기지 않는다 — 옮기는 것은 재검색 버튼뿐이다', () => {
    const first = areaAfterIdle(INITIAL_PLACE_MAP_AREA, FIRST, false)

    expect(areaAfterIdle(first, MOVED, true)).toBe(first)
    expect(areaAfterIdle(areaAfterResearch(FIRST), MOVED, true)).toEqual(areaAfterResearch(FIRST))
  })
})

describe('areaAfterResearch', () => {
  /* 권유 기준과 목록 영역이 같은 자리로 모인다 — 누른 직후에는 버튼이 사라져야 한다 */
  it('누른 자리가 권유 기준이자 목록 필터 영역이 된다', () => {
    expect(areaAfterResearch(MOVED)).toEqual({ origin: MOVED, searched: MOVED })
  })
})

describe('placesInArea', () => {
  const inside = { placeId: '1', lat: 33.5, lng: 126.5 }
  const outside = { placeId: '2', lat: 33.25, lng: 126.5 }
  const noCoord = { placeId: '3', lat: null, lng: null }
  const places = [inside, outside, noCoord]

  it('영역이 없으면(재검색 전) 거르지 않는다 — 같은 배열을 그대로 돌려준다', () => {
    // 참조까지 같아야 useMemo 아래의 핀 배열이 괜히 새로 서지 않는다
    expect(placesInArea(places, null)).toBe(places)
  })

  it('영역이 있으면 그 안의 장소만 남긴다', () => {
    expect(placesInArea(places, FIRST).map((place) => place.placeId)).toEqual(['1', '3'])
  })

  it('좌표가 없는 곳은 숨기지 않는다 — 목록으로도 같은 정보에 닿아야 한다 (#14)', () => {
    expect(placesInArea([noCoord], MOVED)).toEqual([noCoord])
  })
})
