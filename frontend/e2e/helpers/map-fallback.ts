import { expect, type Page } from '@playwright/test'

/**
 * **지도 SDK 실패로 목록 보기로 옮겨질 때까지 기다린다** — #1289 · #1299.
 *
 * ### e2e 의 지도 갈래는 늘 목록으로 옮겨진다
 *
 * e2e 는 `MOCK_API=true` 이고 카카오 SDK 가 뜨지 않는다(키 없음 · 도메인 불일치). #1289 부터 SDK 가
 * 실패하면 지도 자리에 안내 + 축소판 목록을 그리지 않고 **그 화면의 목록 보기로 `router.replace`** 하며
 * 토스트로 이유를 한 번 말한다(`features/map/use-map-failure-fallback.ts`). 그래서 e2e 에서 지도
 * 갈래로 들어간 스펙이 실제로 재는 것은 **"옮겨진 목록 보기"** 다.
 *
 * ### 무엇을 기다리나 — 두 가지 다
 *
 * 1. **토스트의 꼬리** `목록으로 보여드려요` — 세 사유(`errorNoKey` · `errorScript` ·
 *    `errorUnsupported`) 문구가 공유한다. 환경마다 사유가 갈리므로(키가 없으면 `no-key`, 키가 있어도
 *    도메인이 안 맞으면 스크립트 실패) 사유별 문구를 고르지 않는다. 이것이 보이면 **실패 갈래를 탔다**.
 * 2. **주소가 목록 보기로 바뀐 것** — 토스트는 `replace` **직전**에 뜬다. App Router 는 새 트리를
 *    커밋한 뒤 주소를 바꾸므로, 주소가 바뀌었으면 목록 보기의 입력이 이미 붙어 있다. 토스트만 보고 치면
 *    떨어져 나갈 지도 갈래의 입력에 채우게 된다 — 예전 플레이크(채운 값이 새 입력 초기값에 덮이고
 *    엔터가 떨어진 노드로 감)와 같은 모양이다.
 *
 * `isList` 는 화면마다 다르다: `/places` · 담기는 `view=list` 가 실리고, `/emergency` 는 목록이 기본이라
 * `view` 가 빠진다(`view=map` 이 사라지는 것으로 안다).
 */
const FALLBACK_TOAST_TAIL = '목록으로 보여드려요'

export async function mapFailedToList(page: Page, isList: (url: URL) => boolean): Promise<void> {
  await expect(page.getByText(FALLBACK_TOAST_TAIL)).toBeVisible()
  await expect(page).toHaveURL(isList)
}

/** `/places` · 일정 담기 — 목록 보기는 `view=list` 를 싣는다 */
export const hasListView = (url: URL): boolean => url.searchParams.get('view') === 'list'

/** `/emergency` — 목록이 기본 보기라 `view=map` 이 빠지면 목록이다 */
export const leftMapView = (url: URL): boolean => url.searchParams.get('view') !== 'map'
