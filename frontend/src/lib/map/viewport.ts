import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'

/**
 * 지도 뷰포트 계산.
 *
 * SDK 객체를 받지 않고 **평범한 숫자만** 다룬다. 지도 코드에서 가장 틀리기 쉬운 부분이
 * 여기(경계 판정·반경 환산)인데 SDK 를 끼고 있으면 테스트를 쓸 수 없다.
 * 호출부가 `map.getBounds()` 를 이 형태로 옮겨 담아 넘긴다.
 */

/** 남서 / 북동 두 점으로 표현한 지도 영역 */
export type MapBounds = {
  sw: LatLng
  ne: LatLng
}

/**
 * 영역 안에 있는가.
 *
 * **경도 날짜변경선을 넘는 영역은 다루지 않는다.** 제주 전용 서비스라 `sw.lng > ne.lng`
 * 인 영역이 나올 수 없고, 일반화하면 판정이 복잡해져 오히려 틀린다.
 */
export function isWithinBounds(bounds: MapBounds, point: LatLng): boolean {
  return (
    point.lat >= bounds.sw.lat &&
    point.lat <= bounds.ne.lat &&
    point.lng >= bounds.sw.lng &&
    point.lng <= bounds.ne.lng
  )
}

/** 영역의 중심 */
export function boundsCenter(bounds: MapBounds): LatLng {
  return {
    lat: (bounds.sw.lat + bounds.ne.lat) / 2,
    lng: (bounds.sw.lng + bounds.ne.lng) / 2,
  }
}

/**
 * 영역을 감싸는 원의 반경(m).
 *
 * `GET /places/nearby` 는 사각형이 아니라 **중심 + 반경**을 받는다. 중심에서 모서리까지를
 * 반경으로 삼아야 화면에 보이는 영역이 조회 범위 안에 전부 들어온다 — 변의 절반을 쓰면
 * 네 모서리가 빠져 "지도에 보이는데 목록에 없는" 장소가 생긴다.
 *
 * `min` 을 두는 이유: 최대로 확대하면 반경이 수십 m 가 되어 아무것도 잡히지 않는다.
 * `max` 는 백엔드 `@Max(50_000)` 이다.
 */
export function boundsRadiusMeters(bounds: MapBounds, min = 300, max = 50_000): number {
  const corner = haversineMeters(boundsCenter(bounds), bounds.ne)
  if (corner === null) return min

  return Math.round(Math.min(max, Math.max(min, corner)))
}

/**
 * 두 영역이 실질적으로 같은가.
 *
 * "지도 이동 시 재검색" 이 켜져 있으면 `idle` 이벤트마다 재조회가 나가는데, 손가락이
 * 살짝 스친 정도(수 m)까지 재조회하면 요청이 폭주하고 목록이 계속 깜빡인다.
 * **중심 이동이 임계값 미만이면 같은 영역으로 본다.**
 */
export function isSameViewport(
  a: MapBounds | null,
  b: MapBounds | null,
  thresholdM = 200,
): boolean {
  if (a === null || b === null) return false

  const moved = haversineMeters(boundsCenter(a), boundsCenter(b))
  if (moved === null) return false
  if (moved >= thresholdM) return false

  // 중심이 그대로라도 확대·축소했으면 다른 영역이다
  const radiusA = boundsRadiusMeters(a)
  const radiusB = boundsRadiusMeters(b)
  const ratio = radiusA === 0 ? 1 : Math.abs(radiusA - radiusB) / radiusA

  return ratio < 0.1
}

/**
 * 카카오 확대 단계 → **픽셀당 미터.**
 *
 * 실측으로 확인했다 (2026-09-08, dev · 컨테이너 1280×656 · level 10): 마커 두 개의 화면
 * 좌표차와 좌표값차로 재면 129.5 m/px 이고, 이 식이 주는 128 과 1% 안에서 맞는다.
 * 같은 식이 `coord.ts` 에 적혀 있던 다른 실측("7 이면 반경 11km")도 재현한다 —
 * √(640² + 328²) × 16 = 11.5km.
 *
 * **SDK 에 이 값을 물어볼 방법이 없다.** `map.getBounds()` 는 지도를 만든 뒤에야
 * 답하는데, 첫 중심을 정하는 일은 지도를 만들기 **전**에 끝나야 한다 (만든 뒤에 옮기면
 * 그 이동이 `idle` 을 한 번 더 부르고, 그것이 사용자의 이동으로 세어져 첫 화면부터
 * 주변 검색으로 갈아탄다). 그래서 환산식을 여기 고정해 둔다.
 */
export function metersPerPixel(level: number): number {
  return 0.25 * 2 ** (level - 1)
}

/** 위도 1도의 남북 거리(m). 제주만 다루므로 상수로 충분하다 */
const METERS_PER_LAT_DEGREE = 111_320

/**
 * 컨테이너 높이를 아직 모를 때 쓰는 대체값.
 *
 * 시트나 탭 뒤에서 지도가 만들어지면 `clientHeight` 가 0 이고, 그대로 계산하면 위도
 * 폭이 0 이 되어 **중심이 해안선 위(바다)로 올라간다.** 데스크톱 실측값을 대신 쓴다.
 */
const FALLBACK_HEIGHT_PX = 640

/**
 * 기준 위도가 화면 위쪽 `seaRatio` 지점에 오는 **지도 중심의 위도.**
 *
 * 첫 화면을 "위쪽은 바다 · 아래쪽은 육지" 로 열기 위한 계산이다. 중심을 상수로 박으면
 * 뷰포트 높이에 따라 바다 비율이 흔들린다 — 같은 좌표가 데스크톱에서 35%, 모바일에서
 * 21% 가 된다. 높이를 받아 그때그때 역산하면 어느 화면에서도 같은 구도가 된다.
 *
 * 화면 위에서 아래로 갈수록 위도는 **작아진다.** 중심은 화면 정중앙(0.5)이므로,
 * 기준 위도는 중심보다 `(0.5 - seaRatio)` 만큼 위에 있다.
 */
export function framedCenterLat(
  anchorLat: number,
  heightPx: number,
  level: number,
  seaRatio: number,
): number {
  const height = heightPx > 0 ? heightPx : FALLBACK_HEIGHT_PX
  const latSpan = (metersPerPixel(level) * height) / METERS_PER_LAT_DEGREE

  return anchorLat - (0.5 - seaRatio) * latSpan
}

/**
 * 카카오 확대 단계의 범위. **작을수록 확대**다.
 *
 * SDK 가 상수로 노출하지 않아 여기 적어 둔다 — 범위를 벗어난 값을 `setLevel` 에 넣으면
 * 조용히 무시되고, 그러면 첫 화면이 "왜 이 확대인지" 설명할 수 없는 상태가 된다.
 */
const MIN_MAP_LEVEL = 1
const MAX_MAP_LEVEL = 14

/**
 * `meters` 가 `pixels` 안에 들어오는 **가장 작은(= 가장 확대된) 확대 단계.**
 *
 * 긴급 시설 화면이 "내 위치 반경 10km 를 조회했으니 그만큼을 보여준다" 를 지키기 위한
 * 역산이다. 단계를 상수로 박으면 뷰포트마다 보이는 범위가 달라져, 375 에서는 반경
 * 절반이 화면 밖이고 1280 에서는 빈 바다가 절반이 된다.
 *
 * **경계는 담기는 쪽으로 본다** (`>=`). 딱 맞는 폭을 한 단계 더 축소하면 조회 범위
 * 바깥이 화면에 들어오고, 그 자리는 재조회하지 않는 이 화면에서 영구히 비어 보인다.
 *
 * `pixels` 가 0 이면 `framedCenterLat` 과 같은 대체 높이를 쓴다 — 시트나 탭 뒤에서
 * 지도가 만들어지면 `clientHeight` 가 0 이고, 그대로 계산하면 최대 축소로 떨어진다.
 */
export function levelForSpanMeters(meters: number, pixels: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return MAX_MAP_LEVEL

  const span = Number.isFinite(pixels) && pixels > 0 ? pixels : FALLBACK_HEIGHT_PX

  for (let level = MIN_MAP_LEVEL; level <= MAX_MAP_LEVEL; level += 1) {
    if (metersPerPixel(level) * span >= meters) return level
  }

  return MAX_MAP_LEVEL
}

/**
 * 담고 싶은 **사각형**의 동서(가로) · 남북(세로) 폭(m).
 *
 * 여러 점을 담는 지도(동선 카드)가 쓴다. 원(지름 하나)으로 접으면 긴 변을 컨테이너의
 * **짧은 변**에 맞추게 되는데, 동선 칸은 가로로 넓고 제주 동선은 대개 동서로 길다 —
 * 긴 쪽을 짧은 쪽에 맞춰 한두 단계 멀어졌다 (#982).
 */
export type SpanBox = {
  widthMeters: number
  heightMeters: number
}

/**
 * 사각형을 담을 때 네 변에 두는 여백(px).
 *
 * **비율이 아니라 픽셀이다.** 가장자리에 걸리는 것은 핀이고 핀은 화면에서 크기가 정해져
 * 있다 — 순번 핀은 지름 32px 원이라 좌표에서 16px 을 차지하고, 그만큼을 더 띄운다.
 * 비율(× 1.4)로 주면 먼 동선일수록 여백만 커져 72km 동선에 29km 를 더했고, 그것만으로
 * 모바일에서 한 단계를 잃었다 (#982). 카카오 `setBounds` 도 여백을 픽셀로 받는다.
 */
const BOX_PADDING_PX = 32

/**
 * `box` 가 양쪽 `BOX_PADDING_PX` 를 뺀 컨테이너 안에 들어오는 **가장 확대된 단계.**
 *
 * **축마다 따로 맞추고 더 축소된 쪽을 쓴다.** 동서 폭은 가로에, 남북 폭은 세로에 대야
 * 한다 — 둘을 섞으면 넓은 컨테이너의 가로가 버려진다.
 *
 * 폭이 0 인 축(같은 위도의 두 곳)은 단계를 정하지 않는다. `levelForSpanMeters` 는 0 에
 * 최대 축소를 주는데, 그 축이 `max` 를 이겨 다른 축을 무시하게 된다. 두 축이 모두 0 이면
 * 그 함수와 같이 최대 축소다.
 *
 * 크기가 0 인 축은 `levelForSpanMeters` 의 대체 크기를 그대로 탄다 — 0 에서 여백을 빼면
 * 음수라, 대체값 판정이 먼저다.
 */
export function levelForBoxMeters(box: SpanBox, width: number, height: number): number {
  const usable = (pixels: number) =>
    Number.isFinite(pixels) && pixels > 0 ? Math.max(1, pixels - BOX_PADDING_PX * 2) : 0

  const levels: number[] = []
  if (Number.isFinite(box.widthMeters) && box.widthMeters > 0) {
    levels.push(levelForSpanMeters(box.widthMeters, usable(width)))
  }
  if (Number.isFinite(box.heightMeters) && box.heightMeters > 0) {
    levels.push(levelForSpanMeters(box.heightMeters, usable(height)))
  }

  return levels.length === 0 ? MAX_MAP_LEVEL : Math.max(...levels)
}

/**
 * 기준점과 담고 싶은 폭으로 **첫 카메라(중심 + 확대 단계)** 를 만든다.
 *
 * `framedCenterLat` 과 `levelForSpanMeters` 를 한 번에 묶는다 — 두 함수를 호출부가
 * 따로 부르면 **level 을 두 번 정하게 되고**(하나는 확대용, 하나는 위도 폭 환산용)
 * 둘이 어긋나면 구도가 조용히 틀어진다.
 *
 * **숫자(원의 지름)는 짧은 변으로 단계를 정한다.** 원은 어느 방향으로든 같은 폭이라
 * 긴 변에 맞추면 짧은 변에서 잘려 조회 범위의 일부가 화면 밖에 남는다.
 *
 * **사각형(`SpanBox`)은 축마다 맞춘다** (`levelForBoxMeters`) — 담을 것의 모양을 아는
 * 호출부(동선 카드)가 넘긴다.
 */
export function framedCamera(input: {
  anchor: LatLng
  /**
   * 화면에 담고 싶은 폭(m). 반경이면 **지름**을 넘긴다. 여러 점을 담으면 그 사각형의
   * 두 변을 `SpanBox` 로 넘긴다
   */
  spanMeters: number | SpanBox
  width: number
  height: number
  /** 기준점이 화면 위쪽 몇 할 지점에 올지. 0.5 면 정중앙 */
  seaRatio: number
}): { lat: number; lng: number; level: number } {
  const level =
    typeof input.spanMeters === 'number'
      ? levelForSpanMeters(input.spanMeters, Math.min(input.width, input.height))
      : levelForBoxMeters(input.spanMeters, input.width, input.height)

  return {
    lat: framedCenterLat(input.anchor.lat, input.height, level, input.seaRatio),
    lng: input.anchor.lng,
    level,
  }
}

/** 컨테이너 크기(px) */
type ContainerSize = { width: number; height: number }

/**
 * 칸 크기가 바뀌었을 때 카메라를 **다시 맞출지** (#982, `MapCanvas` 의 `refitOnResize`).
 *
 * - 사용자가 옮겼으면(`moved`) 맞추지 않는다 — 그때 화면은 우리 틀이 아니라 사용자의 것이다
 * - 크기가 그대로면 맞추지 않는다 — `observe` 직후 첫 알림이 늘 이것이고, 같은 틀을 한 번
 *   더 놓으면 `onCameraApplied` 가 이유 없이 두 번 불린다
 * - 새 크기에 0 인 변이 있으면 맞추지 않는다 — 칸이 탭·시트 뒤로 숨은 것이다. 그때 맞추면
 *   대체 크기로 잰 엉뚱한 틀이 놓이고, 다시 보일 때 크기가 또 바뀌어 그때 맞추면 된다
 */
export function shouldRefit(input: {
  fitted: ContainerSize
  next: ContainerSize
  moved: boolean
}): boolean {
  if (input.moved) return false
  if (input.next.width <= 0 || input.next.height <= 0) return false

  return input.next.width !== input.fitted.width || input.next.height !== input.fitted.height
}
