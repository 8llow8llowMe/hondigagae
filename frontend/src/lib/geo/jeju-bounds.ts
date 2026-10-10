import type { LatLng } from '@/lib/geo/coord'

/**
 * 제주 안인지 판정하는 경계 상자.
 *
 * **이 서비스의 데이터는 제주뿐이다.** 그래서 제주 밖 좌표로 조회하면 오류가 아니라
 * **조용한 0건**이 온다 — dev 실측: 서울시청(37.5665, 126.9780)으로
 * `GET /emergencies/facilities?radius=10000` 을 부르면 `HTTP 200` · `success: true` ·
 * `facilities: []` · `totalCount: 0` 이다. 화면은 "반경 안에 없어요" 만 말하게 되고,
 * 사용자는 기능이 고장 났다고 읽는다. 같은 좌표를 제주시청으로 바꾸면 3건이 온다.
 *
 * 그래서 **좌표를 얻는 자리에서 한 번 거른다** (`getCurrentPosition`). 화면마다
 * 판정하면 어느 화면은 빠뜨린다.
 *
 * 경계값의 근거 — **행정구역 기준이고 본섬만이 아니다.**
 *
 * | 지점                        | 좌표          | 왜 이 값인가              |
 * | --------------------------- | ------------- | ------------------------- |
 * | 마라도 (최남단)             | 33.107        | `minLat` 아래여야 한다    |
 * | 추자도 (최북단, 행정상 제주시) | 34.058     | `maxLat` 위여야 한다      |
 * | 제주 서쪽 (수월봉·차귀도)   | 126.15        | `minLng` 안              |
 * | 우도 (동쪽)                 | 126.97        | `maxLng` 안              |
 *
 * **본토와 겹치지 않는다.** 가장 가까운 본토 지점이 완도(34.31) · 진도(34.48) ·
 * 목포(34.79) 로 전부 `maxLat` 34.1 위다 — 추자도를 담으면서 본토를 배제하는 값이
 * 이 사이에만 있다. 그래서 `maxLat` 을 34.1 보다 키우면 안 된다.
 */
export const JEJU_BOUNDS = {
  minLat: 33.0,
  maxLat: 34.1,
  minLng: 126.0,
  maxLng: 127.0,
} as const

/**
 * 이 좌표가 제주 안인가.
 *
 * **경계는 포함이다.** 상자 자체가 이미 넉넉하게 잡혀 있어 경계에서 한 칸을 다투는 것이
 * 뜻을 갖지 않는다.
 */
export function isInJeju(point: LatLng): boolean {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false

  return (
    point.lat >= JEJU_BOUNDS.minLat &&
    point.lat <= JEJU_BOUNDS.maxLat &&
    point.lng >= JEJU_BOUNDS.minLng &&
    point.lng <= JEJU_BOUNDS.maxLng
  )
}
