import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS } from '@/lib/api/emergency'
import {
  DEFAULT_FACILITY_FILTERS,
  FACILITY_TYPE_CODES,
  type FacilityFilters,
  type FacilityTypeCode,
} from '@/types/emergency'

/**
 * 긴급 시설 화면 조건의 URL 직렬화.
 *
 * 규약 (docs/architecture-guide.md §10)
 *  - 키 이름은 백엔드 파라미터 이름과 같게 둔다 (`radius`). 화면에서만 좁히는 축
 *    (`type` · `open24Only` · `openNowOnly`)은 보낼 서버 파라미터가 없으므로
 *    `FacilityFilters` 의 필드명을 그대로 쓴다
 *  - 기본값은 URL 에서 생략한다 → 빈 URL = 기본 상태
 *  - 잘못된 값은 예외를 던지지 않고 기본값으로 떨어뜨린다 (URL 은 사용자가 손으로 고친다)
 *  - `view` 는 이 모듈이 읽지도 쓰지도 않는다 — `lib/url/view-mode.ts` 소유다.
 *    보기와 조건을 합치는 것은 `viewModeHref` 한 곳이다
 *
 * **`RADIUS_OPTIONS` · `widen()` 이 여기 사는 이유:** 시트 선택지 · 넓히기 사다리 ·
 * URL 화이트리스트 셋은 "어긋나면 안 된다" 는 관계다 (사다리가 목록 밖으로 나가면 0건
 * 화면의 "반경 넓히기" 를 누른 뒤 칩이 시트에 없는 값을 가리킨다). 셋을 한 파일에 둔다.
 * `src/lib/` 는 `src/features/` 를 임포트할 수 없으므로(§3) 내려오는 방향도 이쪽뿐이다.
 */

/**
 * 반경 선택지. `widen()` 의 ×2 사다리와 백엔드 상한(`@Max(50_000)`)을 그대로 따른다.
 */
export const RADIUS_OPTIONS = [10_000, 20_000, 40_000, MAX_RADIUS_METERS] as const
export type RadiusOption = (typeof RADIUS_OPTIONS)[number]

/** 넓히기 한 번에 두 배. 10km → 20km → 40km → 50km(상한) */
export function widen(radius: number): number {
  return Math.min(MAX_RADIUS_METERS, radius * 2)
}

/**
 * 이 화면이 URL 에 두는 것 전부.
 *
 * **반경이 `filters` 밖에 있는 것은 의도다.** 반경은 필터가 아니라 조회 파라미터라
 * `EmergencyFilterBar` 의 「초기화」 대상이 아니다 — 초기화가 반경까지 되돌리면 넓혀
 * 찾던 사용자가 조건 하나를 끄려다 결과를 통째로 잃는다. 그 구분을 주석이 아니라
 * 타입 모양으로 새겨 둔다: 초기화는 `filters` 만 갈아 끼운다.
 */
export type EmergencyBoardParams = {
  filters: FacilityFilters
  radius: number
}

export const DEFAULT_EMERGENCY_BOARD_PARAMS: EmergencyBoardParams = {
  filters: DEFAULT_FACILITY_FILTERS,
  radius: DEFAULT_RADIUS_METERS,
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: RawParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function readFacilityType(value: string | null): FacilityTypeCode | null {
  if (value === null) return null
  return FACILITY_TYPE_CODES.includes(value as FacilityTypeCode)
    ? (value as FacilityTypeCode)
    : null
}

/** 켜짐은 `true` 하나만 인정한다. `1`·`on` 은 켜지지 않는다 — 쓰는 쪽이 `true` 만 쓴다 */
function readFlag(value: string | null): boolean {
  return value === 'true'
}

/**
 * 반경은 **화이트리스트**다. 범위 검사로 두면 `?radius=33333` 이 통과해 칩은 "33.3km"
 * 인데 반경 시트에는 선택된 항목이 없는 화면이 된다.
 */
function readRadius(value: string | null): number {
  const radius = Number(value)
  return RADIUS_OPTIONS.includes(radius as RadiusOption) ? radius : DEFAULT_RADIUS_METERS
}

export function parseEmergencyBoardParams(params: RawParams): EmergencyBoardParams {
  return {
    filters: {
      type: readFacilityType(read(params, 'type')),
      open24Only: readFlag(read(params, 'open24Only')),
      openNowOnly: readFlag(read(params, 'openNowOnly')),
    },
    radius: readRadius(read(params, 'radius')),
  }
}

/** 화면 URL 용 쿼리 문자열. 기본값은 생략한다 */
export function toEmergencyBoardQuery({ filters, radius }: EmergencyBoardParams): string {
  const params = new URLSearchParams()

  if (filters.type !== null) params.set('type', filters.type)
  if (filters.open24Only) params.set('open24Only', 'true')
  if (filters.openNowOnly) params.set('openNowOnly', 'true')
  if (radius !== DEFAULT_RADIUS_METERS) params.set('radius', String(radius))

  return params.toString()
}
