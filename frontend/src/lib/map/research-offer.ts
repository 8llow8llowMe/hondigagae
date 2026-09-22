import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters } from '@/lib/geo/distance'
import { boundsCenter, boundsRadiusMeters, type MapBounds } from '@/lib/map/viewport'

/**
 * "이 지역에서 재검색" 을 권할 때인가 — 이슈 #396.
 *
 * **두 지도 화면이 같은 함수를 쓴다** (`/emergency` · `/places`). 지도를 옮겼다고
 * 스스로 재조회하지 않고 **재조회 시점을 사용자가 쥐는 것**이 두 화면의 공통 규칙이고
 * (아래), 권할 때와 아닐 때를 가르는 판정도 하나여야 한다 — 한쪽만 고치면 같은 버튼이
 * 화면마다 다른 순간에 뜬다.
 *
 * 자동 재조회를 걷은 이유는 화면마다 다르다.
 *  - `/emergency`: 재조회하면 `distanceMeters` 가 지도 중심 기준이 되어 "가까운 순 ·
 *    480m" 이 거짓이 된다 (PR #373).
 *  - `/places`: 한 장소를 골라 확대하거나 화면을 조금 옮길 때마다 목록이 통째로 다시
 *    조회돼 방금 보던 결과가 사라졌다 (#849 후속). 조회 자체가 사용자가 시킨 일이
 *    아닌데 목록이 흔들린다.
 *
 * **임계값이 반경에 비례한다.** 반경 1km 를 보다가 300m 옮긴 것과 반경 40km 를 보다가
 * 300m 옮긴 것은 전혀 다른 일이다. 고정 미터로 두면 넓은 반경에서 손만 스쳐도 버튼이
 * 뜨고, 좁은 반경에서는 화면 밖으로 나가도 안 뜬다.
 *
 * `0.3` 은 **조회 범위의 30% 를 벗어난 지점**이다. 그보다 작으면 지금 목록이 여전히 그
 * 자리를 충분히 덮고 있어 재조회할 이유가 없다. **확대·축소 갈래도 같은 값을 쓴다**
 * (`originScreenRadius`) — "30% 벗어남" 이라는 한 가지 뜻이면 상수도 하나여야 한다.
 */
export const RESEARCH_OFFER_RATIO = 0.3

export function shouldOfferResearch(params: {
  /** 지금 지도가 보여주는 영역. 첫 `idle` 전이면 null */
  bounds: MapBounds | null
  /**
   * **지금 목록이 대응하는 지도 중심.** 조회 기준점(`anchor`)이 아니다 — 이슈 #578.
   *
   * 지도를 놓는 규칙(`framedCenterLat`)은 기준점을 화면 정중앙이 아니라 위쪽
   * `JEJU_MAP_SEA_RATIO`(35%) 지점에 놓는다. 위쪽은 바다, 아래쪽은 육지로 열리게 하려는
   * 의도된 프레이밍이다(`lib/geo/coord.ts`). 그래서 **지도 중심은 기준점보다 화면 높이의
   * 15% 만큼 남쪽**이고, 그 거리는 확대 단계에 비례해 커진다 — 섬 전체가 보이는 첫
   * 화면에서 4~5.5km 였다.
   *
   * 예전에는 여기에 `anchor` 를 넘겼다. 그러면 **그 의도된 오프셋이 "사용자가 지도를
   * 옮겼다" 로 읽혀** 조작 0회에서 버튼이 떴고, 누르면 기준점이 지도 중심으로 옮겨가며
   * 카메라가 같은 규칙으로 다시 프레이밍해 오프셋이 그대로 재생됐다 — 버튼이 사라지지
   * 않고 누를 때마다 지도가 4km 씩 남하했다.
   *
   * **재는 것은 "지금 목록이 선 자리"와 "지금 보이는 자리"의 차이다.** `/emergency` 는
   * 카메라가 놓은 중심이고(`onCameraApplied`), `/places` 는 마지막으로 조회한 영역의
   * 중심이다. 아직 없으면 null 이고, 그때는 권하지 않는다.
   */
  origin: LatLng | null
  /** 조회 반경(m) — 임계값의 자 */
  radius: number
  /**
   * 지금은 묻지 않는다.
   *
   * **"판정 근거를 아직 못 믿는 동안" 이라는 뜻이다.** 우리가 카메라를 옮겨 놓고 그
   * 결과를 아직 재지 못한 구간이 그렇다 — `/emergency` 에서 시설을 고르면 지도가
   * `SELECTED_FACILITY_MAP_LEVEL` 까지 확대되는데, 카카오 SDK 는 그 애니메이션 이동에서
   * 쓸 만한 `idle` 을 내지 않아 `bounds` 가 실제 화면과 어긋난 채로 남는다
   * (`emergency-map-view.tsx` 의 `boundsStale`). 그 어긋남으로 판정하면 우리가 확대한
   * 것을 사용자의 이동으로 읽는다.
   *
   * **"고른 상태" 자체는 이유가 아니다.** 예전에는 이 자리가 `selected` 였고, 그래서
   * 시설을 고른 뒤에는 **사용자가 지도를 직접 끌어도** 버튼이 뜨지 않았다 — 한 곳을
   * 보다가 옆 동네를 확인하려면 선택부터 풀어야 했다. 진짜 `idle` 이 와서 `bounds` 가
   * 다시 믿을 수 있게 되면 고른 상태와 무관하게 권한다.
   */
  suppressed: boolean
  /**
   * 조회 시점의 **화면 반경**(m). 주면 중심이 그대로여도 확대·축소만으로 권한다.
   *
   * **조회 반경을 화면에서 역산하는 화면만 넘긴다** (`/places`). 거기서는 축소가 곧
   * "더 넓게 찾아 줘" 라 중심이 한 픽셀도 안 움직여도 재조회할 이유가 생긴다.
   *
   * **`/emergency` 는 넘기지 않는다.** 그 화면의 반경은 URL 이 소유하는 칩 값이고
   * (`useEmergencyNav`), 재검색은 **반경을 그대로 둔 채** 기준점만 옮긴다 — 줌으로
   * 버튼을 띄우면 눌러도 조회 범위가 그대로라 버튼이 거짓말을 한다.
   */
  originScreenRadius?: number | undefined
}): boolean {
  const { bounds, origin, radius, suppressed, originScreenRadius } = params

  if (suppressed || bounds === null || origin === null) return false
  if (!Number.isFinite(radius) || radius <= 0) return false

  const moved = haversineMeters(origin, boundsCenter(bounds))
  if (moved === null) return false
  if (moved > radius * RESEARCH_OFFER_RATIO) return true

  // 확대·축소 갈래는 넘겨받은 화면에서만 돈다 — 위 doc-comment 참고
  if (originScreenRadius === undefined) return false
  if (!Number.isFinite(originScreenRadius) || originScreenRadius <= 0) return false

  const zoomed = Math.abs(boundsRadiusMeters(bounds) - originScreenRadius) / originScreenRadius
  return zoomed > RESEARCH_OFFER_RATIO
}
