import { JEJU_QUERY_CENTER, type PositionResult } from '@/lib/geo/current-position'

/**
 * 홈 골든타임 조회 좌표와 기준 표기 (#1142).
 *
 * **위치를 알기 전에도 제주 중심으로 조회한다.** 예전에는 `position === null` 이면 조회를 껐다
 * — 클라이언트가 마운트되고 `getPositionIfGranted()` 가 끝난 뒤에야 문장이 그려져, 홈의 LCP
 * 요소인 골든타임 문장이 FCP 보다 약 5초 늦었다(Lighthouse 모바일 Render Delay).
 *
 * 비로그인 방문자는 위치 판정이 끝나도 제주 중심 폴백이다(진입에서 묻지 않는다, #1133). 그래서
 * **서버가 같은 좌표 · 같은 조건으로 미리 받아 둔 캐시와 query key 가 같아** 첫 HTML 에 문장이
 * 들어간다. 허용된 사용자는 위치가 정해지면 key 가 바뀌어 현재 위치로 다시 받는다.
 */
export const WALK_TIMES_PREFETCH_POSITION = JEJU_QUERY_CENTER

export function walkTimesQueryPosition(position: PositionResult | null): {
  lat: number
  lng: number
} {
  return position === null ? WALK_TIMES_PREFETCH_POSITION : { lat: position.lat, lng: position.lng }
}

/**
 * 기준 줄(`제주시 기준` / `현재 위치 기준`). **화면에 보이는 데이터의 좌표를 말한다.**
 *
 * 위치가 허용돼 현재 위치로 다시 받는 동안은 `placeholderData` 가 직전(제주 기준) 데이터를
 * 보여 준다 — 그동안 `현재 위치 기준` 이라고 하면 제주 숫자에 다른 이름표를 붙이게 된다.
 */
export function walkTimesBasis(
  position: PositionResult | null,
  isPlaceholderData: boolean,
): 'jeju' | 'current' {
  return position !== null && position.kind === 'granted' && !isPlaceholderData ? 'current' : 'jeju'
}
