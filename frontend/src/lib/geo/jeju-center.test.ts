import { describe, expect, it } from 'vitest'

import {
  JEJU_MAP_ANCHOR,
  JEJU_MAP_LEVEL,
  JEJU_MAP_SEA_RATIO,
  SELECTED_PLACE_MAP_LEVEL,
} from '@/lib/geo/coord'
import { JEJU_QUERY_CENTER } from '@/lib/geo/current-position'
import { isInJeju } from '@/lib/geo/jeju-bounds'
import { framedCenterLat, metersPerPixel } from '@/lib/map/viewport'

/**
 * 같은 이름의 상수 둘이 다른 값을 갖고 있었고, 지도(#14)가 그중 하나를 잘못 집어
 * 첫 화면이 비었다. 이름과 쓰임이 갈렸다는 것을 테스트로 고정한다.
 */
describe('제주 기준 좌표 두 개', () => {
  it('둘은 다른 지점이다 — 같은 값이 되면 이름을 나눈 이유가 사라진다', () => {
    expect(JEJU_QUERY_CENTER.lat).not.toBe(JEJU_MAP_ANCHOR.lat)
  })

  it('둘 다 제주 안이다 — 위도 33 / 경도 126', () => {
    for (const point of [JEJU_MAP_ANCHOR, JEJU_QUERY_CENTER]) {
      expect(point.lat).toBeGreaterThan(33)
      expect(point.lat).toBeLessThan(34)
      expect(point.lng).toBeGreaterThan(126)
      expect(point.lng).toBeLessThan(127)
    }
  })

  it('지도 기준선이 조회 기준점보다 북쪽이다 — 해안선이 제주시청 위다', () => {
    expect(JEJU_MAP_ANCHOR.lat).toBeGreaterThan(JEJU_QUERY_CENTER.lat)
  })
})

/**
 * 첫 확대 단계와 프레이밍은 **함께 봐야 뜻이 있다.** 단계만 보면 "가까울수록 좋다" 로
 * 읽히지만, 너무 가까우면 첫 화면에서 서귀포가 통째로 빠진다.
 */
describe('지도 첫 화면', () => {
  it('확대 단계는 8~9 다 — 10 은 섬 좌우가 빈 바다, 7 은 한라산만 보인다', () => {
    expect(JEJU_MAP_LEVEL).toBeGreaterThanOrEqual(8)
    expect(JEJU_MAP_LEVEL).toBeLessThanOrEqual(9)
  })

  it.each([
    ['데스크톱', 656],
    ['노트북 세로 여유', 830],
    ['모바일', 600],
  ])('%s 에서 첫 중심이 제주 안이고 제주시청보다 남쪽이다', (_name, heightPx) => {
    const lat = framedCenterLat(JEJU_MAP_ANCHOR.lat, heightPx, JEJU_MAP_LEVEL, JEJU_MAP_SEA_RATIO)

    expect(isInJeju({ lat, lng: JEJU_MAP_ANCHOR.lng })).toBe(true)
    // "제주시에서 살짝 아래" 가 요구사항이다 — 해안선을 위쪽 35% 에 두면 그렇게 된다
    expect(lat).toBeLessThan(JEJU_QUERY_CENTER.lat)
  })

  it('컨테이너 높이가 0 이면 대체값으로 계산한다 — 중심이 바다로 올라가지 않는다', () => {
    const lat = framedCenterLat(JEJU_MAP_ANCHOR.lat, 0, JEJU_MAP_LEVEL, JEJU_MAP_SEA_RATIO)

    expect(lat).toBeLessThan(JEJU_MAP_ANCHOR.lat)
    expect(isInJeju({ lat, lng: JEJU_MAP_ANCHOR.lng })).toBe(true)
  })
})

/**
 * 선택 확대 단계는 **목록과 묶여 있다.** 왼쪽 목록이 "지도에 보이는 곳" 이라서, 카드를
 * 누른 뒤 영역이 너무 좁아지면 목록이 한두 건으로 줄고 다음 카드를 이어 누를 수 없다.
 */
describe('목록에서 한 곳을 고를 때의 확대 단계', () => {
  it('첫 화면보다 가깝다 — 고르는 것은 한 곳을 보는 일이다', () => {
    expect(SELECTED_PLACE_MAP_LEVEL).toBeLessThan(JEJU_MAP_LEVEL)
  })

  it('데스크톱 1280 폭에서 4~8km 를 담는다 — 장소와 주변이 함께 보이는 범위다', () => {
    const widthKm = (metersPerPixel(SELECTED_PLACE_MAP_LEVEL) * 1280) / 1000

    expect(widthKm).toBeGreaterThanOrEqual(4)
    expect(widthKm).toBeLessThanOrEqual(8)
  })

  it('모바일 375 폭에서도 1km 이상 담는다 — 핀 하나만 남으면 목록이 비어 버린다', () => {
    const widthKm = (metersPerPixel(SELECTED_PLACE_MAP_LEVEL) * 375) / 1000

    expect(widthKm).toBeGreaterThanOrEqual(1)
  })
})
