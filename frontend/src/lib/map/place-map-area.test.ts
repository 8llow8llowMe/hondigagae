import { describe, expect, it } from 'vitest'

import { haversineMeters } from '@/lib/geo/distance'
import {
  areaAfterFramedIdle,
  areaAfterIdle,
  areaAfterResearch,
  focusedPlaceMapArea,
  framingAfterIdle,
  INITIAL_PLACE_MAP_AREA,
  PLACE_MAP_FOCUS_RADIUS_METERS,
  placesInArea,
} from '@/lib/map/place-map-area'
import { boundsCenter, boundsRadiusMeters, type MapBounds } from '@/lib/map/viewport'

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

/*
  담기 지도가 **기준점에서 연다** — 이슈 #1177.

  첫 목록을 "이 지역에서 재검색" 을 이미 누른 상태로 시작한다. 그런데 지도는 먼저 제주 기본
  위치로 만들어지고 카메라가 한 번 옮긴다 — 첫 `idle`(제주 기본 시야)이 권유 기준을 덮으면
  카메라가 옮긴 뒤 재검색 버튼이 곧바로 뜬다. 그래서 카메라가 놓은 뒤의 `idle` 만 기준으로 삼는다.
*/
const JUNGMUN = { lat: 33.2539, lng: 126.4123 }

describe('focusedPlaceMapArea', () => {
  const area = focusedPlaceMapArea(JUNGMUN)

  it('재검색을 누른 모양이다 — 권유 기준과 목록 영역이 같은 자리다', () => {
    expect(area.searched).not.toBeNull()
    expect(area.origin).toEqual(area.searched)
  })

  it('기준점이 영역의 중심이다', () => {
    const center = boundsCenter(area.searched as MapBounds)

    expect(center.lat).toBeCloseTo(JUNGMUN.lat, 9)
    expect(center.lng).toBeCloseTo(JUNGMUN.lng, 9)
  })

  /* 위도 1도를 상수(111,320m)로 환산한다 — haversine 의 구면 반경과 0.1% 남짓 갈려 1% 로 잰다 */
  it('기준점에서 네 변까지가 반경이다 — 남북·동서 모두', () => {
    const { sw, ne } = area.searched as MapBounds

    for (const edge of [
      { lat: ne.lat, lng: JUNGMUN.lng },
      { lat: sw.lat, lng: JUNGMUN.lng },
      { lat: JUNGMUN.lat, lng: ne.lng },
      { lat: JUNGMUN.lat, lng: sw.lng },
    ]) {
      const meters = haversineMeters(JUNGMUN, edge) as number
      expect(Math.abs(meters - PLACE_MAP_FOCUS_RADIUS_METERS)).toBeLessThan(
        PLACE_MAP_FOCUS_RADIUS_METERS * 0.01,
      )
    }
  })

  /* 주변 조회는 모서리까지를 반경으로 보낸다 (`boundsRadiusMeters`) — 영역 전체가 조회 안에 든다 */
  it('주변 조회 반경은 모서리까지다', () => {
    const radius = boundsRadiusMeters(area.searched as MapBounds)
    expect(Math.abs(radius - PLACE_MAP_FOCUS_RADIUS_METERS * Math.SQRT2)).toBeLessThan(
      PLACE_MAP_FOCUS_RADIUS_METERS * Math.SQRT2 * 0.01,
    )
  })
})

describe('framingAfterIdle — 기준점 지도의 idle', () => {
  it('카메라를 놓기 전의 idle(제주 기본 시야)은 보지 않는다', () => {
    expect(framingAfterIdle('pending')).toEqual({
      framing: 'pending',
      seen: false,
      adoptOrigin: false,
    })
  })

  it('카메라를 놓은 뒤 첫 idle 이 권유 기준이 된다', () => {
    expect(framingAfterIdle('applied')).toEqual({
      framing: 'settled',
      seen: true,
      adoptOrigin: true,
    })
  })

  /* 그 뒤는 `/places` 와 같다 — 사용자의 이동은 보이는 영역만 옮기고 버튼을 띄운다 (#396) */
  it('그 뒤의 idle 은 보이는 영역만 옮긴다', () => {
    expect(framingAfterIdle('settled')).toEqual({
      framing: 'settled',
      seen: true,
      adoptOrigin: false,
    })
  })
})

describe('areaAfterFramedIdle', () => {
  it('권유 기준만 카메라가 놓은 시야로 옮기고 목록 영역(조회 자리)은 그대로 둔다', () => {
    const start = focusedPlaceMapArea(JUNGMUN)
    const next = areaAfterFramedIdle(start, MOVED)

    expect(next.origin).toEqual(MOVED)
    // 목록 영역을 옮기면 주변 조회 키가 바뀌어 한 번 더 조회한다
    expect(next.searched).toBe(start.searched)
  })
})
