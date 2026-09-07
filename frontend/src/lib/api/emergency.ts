import { paths } from '@/lib/api/paths'
import type { NearbyFacilityQuery } from '@/types/emergency'

/**
 * 긴급 시설 조회 경로 조립. 전송은 client.ts / server.ts 가 나눠 담당한다
 * (docs/architecture-guide.md §8).
 */

/** 백엔드 `@Max(50_000)` */
export const MAX_RADIUS_METERS = 50_000
/** 백엔드 `@RequestParam(defaultValue = "10000")` */
export const DEFAULT_RADIUS_METERS = 10_000
/**
 * 백엔드 `@Max(250)`. **상한을 그대로 쓴다.**
 *
 * 화면이 유형·24시간·지금진료중을 **클라이언트에서** 좁히므로(아래 참고) 한 번에 다
 * 받아 와야 칩 개수가 맞는다. 제주 전역이 214곳이라(dev 실측 2026-09-08 ·
 * `radius=50000` → `totalCount=214`) 250 이면 실질적으로 전량이 온다.
 *
 * **50 이던 시절에는 이 상한이 화면을 스스로 멈추게 했다** (#297). 제주시청 반경 10km 만
 * 해도 136곳인데 50에서 잘려, 반경을 넓혀도 칩 개수가 계속 감춰졌다. `size` 상한이
 * 250 으로 오른 뒤(BE #285 / PR #296) 여기를 따라 올렸다.
 *
 * 250 으로도 넘치면 `facilities.length < totalCount` 로 드러나고, 그때 화면이 개수를
 * 감춘다 (`facility-filters.ts`).
 */
export const MAX_SIZE = 250

/**
 * **`type` · `open24Only` · `openNowOnly` 를 서버로 보내지 않는다.**
 *
 * 셋 다 서버 파라미터로 존재하지만, 아트보드는 칩마다 **개수**를 함께 보여준다
 * (`전체 4 · 병원 3 · 약국 1 · 24시간 1 · 지금 진료중 2`). 서버로 좁히면 그 개수를
 * 알려면 칩 수만큼 요청을 더 보내야 하고, 그래도 "지금 이 조건을 끄면 몇 개" 를
 * 말할 수 없다 — 결과 없음 화면이 바로 그것을 말해야 한다.
 *
 * 한 번 받아 와서 화면에서 좁히면 요청은 하나이고 개수는 전부 정확하다.
 */
export function facilitiesPath(query: NearbyFacilityQuery): string {
  const params = new URLSearchParams({
    lat: String(query.lat),
    lng: String(query.lng),
    radius: String(query.radius),
    size: String(query.size),
  })

  return paths.emergencies.facilities(params.toString())
}
