import { messages } from '@/lib/messages'

/**
 * 지도 보기 캡션의 개수 라벨. **두 지도 화면이 같이 쓴다** (`/emergency` · `/places`).
 *
 * `hideViewportClaim` 이 `true` 면 `messages.map.visibleCount`("지도에 보이는 {n}곳")
 * 대신 `messages.map.listCount`("목록 {n}곳") 를 쓴다 — 개수 자체는 어느 쪽에서도
 * 참이므로 숫자는 그대로 두고 **"지도에 보이는" 이라는 주장만** 뺀다.
 *
 * **주장을 빼야 하는 상태가 화면마다 다르다.**
 *  - `/emergency`: 행을 고른 동안(지도가 확대돼 `frozenBounds` 와 실제 프레임이 어긋난다),
 *    그리고 선택이 풀렸어도 `bounds` 가 아직 그 확대를 못 따라잡은 stale 상태
 *    (`emergency-map-view.tsx` 의 `boundsStale`).
 *  - `/places`: 목록이 **마지막으로 조회한 영역**을 세는데 지도가 그 자리에서 벗어났을 때
 *    (`place-map-view.tsx` 의 `searchedBounds`).
 *
 * 순수 함수라 `visible-count.test.ts` 가 표로 고정한다 — 상태 전이는 브라우저로만 잰다.
 */
export function visibleCountLabel(count: number, hideViewportClaim: boolean): string {
  const template = hideViewportClaim ? messages.map.listCount : messages.map.visibleCount
  return template.replace('{n}', String(count))
}
