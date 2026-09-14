import { expect, type Page } from '@playwright/test'

/**
 * **지도 SDK 실패 폴백이 자리를 잡을 때까지 기다린다** — e2e 플레이크의 근본원인.
 *
 * ### 무엇이 흔들렸나
 *
 * 전체 스위트에서 **매번 다른 지도 검색 테스트 하나**가 떨어졌다 (`emergency-search` ·
 * `place-search`). 실패 모양은 늘 같았다 — 엔터를 쳤는데 URL 이 그대로이고, 실패
 * 스냅샷의 검색창이 **채워 넣은 값이 아니라 빈칸**(또는 URL 의 옛 검색어)이었다.
 * 단독 실행하면 전부 통과했다.
 *
 * ### 원인 — 두 갈래가 같은 안정 신호를 갖고 있었다
 *
 * 두 스펙은 `role="status"` 또는 `main li` 로 폴백을 기다렸는데, **둘 다 폴백 이전의
 * 지도 갈래에도 있다**:
 *
 *  · `MapCanvas` 가 SDK 를 부르는 동안 `role="status"`("지도를 불러오는 중")를 그린다.
 *    DOM 상 폴백 안내보다 **앞**이라 `.first()` 가 이것에 붙는다.
 *  · 지도 갈래의 좌측 패널도 목록이라 `main li` 가 이미 차 있다.
 *
 * 그래서 두 대기 모두 **교체 전**에 풀리고, 그 뒤 SDK 실패가 도착하면 React 가
 * 서브트리를 통째로 바꾼다. 지도 갈래는 검색 폼이 **둘**(오버레이 · 패널)이고 폴백은
 * **하나**라 세 폼이 전부 갈린다 — 채워 둔 값은 새 입력의 `useState(filters.keyword)`
 * 초기값으로 덮이고, 엔터는 떨어져 나간 노드로 간다.
 *
 * MutationObserver 로 실제 순서를 찍어 확인했다 (8회 중 2회 재현):
 *
 *     observing 5173ms → filled, value="" → REMOVED form → REMOVED form → ADDED form
 *
 * ### 처방
 *
 * **폴백에만 있는 것**을 기다린다. 세 실패 문구(`errorNoKey` · `errorScript` ·
 * `errorUnsupported`)가 공유하는 꼬리가 그것이다 — 어떤 이유로 실패했든 같은 문장으로
 * 끝나고, 지도 갈래에는 이 문장이 없다. 안내는 폴백 트리와 **같은 커밋**에 그려지므로
 * 이것이 보이면 새 입력도 이미 붙어 있다.
 *
 * 실패 사유별 문구를 골라 쓰지 않는 이유는 **환경마다 사유가 갈리기 때문**이다 — 키가
 * 없으면 `no-key`, 키가 있어도 도메인이 안 맞으면 스크립트 실패다.
 */
const FALLBACK_TAIL = '목록으로 보여드릴게요'

export async function mapFallbackReady(page: Page): Promise<void> {
  await expect(page.getByText(FALLBACK_TAIL)).toBeVisible()
}
