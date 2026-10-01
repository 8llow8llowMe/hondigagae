import type { Page } from '@playwright/test'

/**
 * **앱 라우터가 이 문서에서 마운트됐는지 기다린다** — 이슈 #1094 · #1103.
 *
 * ### 왜 `networkidle` 이 아닌가
 *
 * `waitForLoadState('networkidle')` 은 "500ms 동안 요청이 없다" 는 **추정**이다. 느린 CI 에서는
 * hydration 이 그 창보다 늦게 끝나 클릭이 React 에 닿지 않고, 지도 SDK 처럼 요청이 이어지는
 * 화면에서는 아예 풀리지 않는다. `main` 이 보이는 것도 신호가 아니다 — 그것은 서버 HTML 이다.
 *
 * ### 신호 — `history.state.__NA`
 *
 * 앱 라우터의 `HistoryUpdater` 가 **커밋 때**(`useInsertionEffect`) 현재 항목에
 * `{ __NA: true, … }` 를 `replaceState`(이동이면 `pushState`)로 남긴다
 * (`next/dist/client/components/app-router.js`). 이것이 있으면 라우터와 그 아래 트리가 커밋돼
 * 있다 — 클릭·입력이 React 에 닿고 `router.push` 가 버려지지 않는다.
 *
 * ### `__NA` 만 보면 안 되는 이유 — 이전 문서의 값이 남는다
 *
 * **같은 URL 로 다시 `goto` 하거나 `reload` 하면 새 문서가 이전 문서의 `history.state` 를
 * 그대로 들고 시작한다** (2026-10-01 실측 — `location.replace` 와 다른 URL 로의 `goto` 는
 * `null` 로 시작한다). 그 문서에서는 hydration 전부터 `__NA` 가 참이라 대기가 아무것도
 * 기다리지 않는다.
 *
 * 그래서 문서가 시작할 때의 `history.state` 를 init script 로 붙잡아 두고, **그 객체가 바뀐
 * 뒤의 `__NA`** 를 기다린다. `HistoryUpdater` 는 커밋마다 새 객체로 `replaceState` 하므로 이
 * 문서의 커밋이 있어야만 참이 된다. Chrome 의 `history.state` 는 상태가 바뀌기 전까지 같은
 * 객체를 돌려준다.
 *
 * ### 이 표식이 덮지 않는 것
 *
 * **`loading.tsx` 경계 안의 본문은 루트 커밋 뒤에 따로 hydrate 될 수 있다** — React 는 서버가
 * 완성해 보낸 Suspense 경계를 낮은 우선순위로 미룬다. 지금 이 헬퍼를 쓰는 화면(`(auth)` 의
 * 폼 · 헤더 계정 메뉴 · `window.next.router`)은 그런 경계 밖이다. 경계 안의 요소를 누르기
 * 전에 기다려야 하면 그 요소가 hydrate 됐다는 화면 고유의 신호(effect 가 채우는 값 등)를 쓴다.
 */
const PROBE_KEY = '__e2eAppRouterProbe' as const

type ProbeWindow = Window & { [PROBE_KEY]?: { startState: unknown } }

/**
 * **이동하기 전에 한 번 부른다** — 이후 이 페이지에서 열리는 문서마다 시작 상태를 붙잡는다.
 * `test.beforeEach` 에 둔다.
 */
export async function trackAppRouterMount(page: Page): Promise<void> {
  await page.addInitScript((key: typeof PROBE_KEY) => {
    const startState: unknown = window.history.state
    ;(window as ProbeWindow)[key] = { startState }
  }, PROBE_KEY)
}

/** 지금 문서의 앱 라우터가 커밋될 때까지 기다린다. `trackAppRouterMount` 가 먼저여야 한다 */
export async function waitForAppRouterMounted(page: Page): Promise<void> {
  const tracked = await page.evaluate(
    (key: typeof PROBE_KEY) => (window as ProbeWindow)[key] !== undefined,
    PROBE_KEY,
  )
  if (!tracked) {
    throw new Error(
      'waitForAppRouterMounted: 이 문서가 열리기 전에 trackAppRouterMount(page) 를 부르지 않았다',
    )
  }

  await page.waitForFunction((key: typeof PROBE_KEY) => {
    const probe = (window as ProbeWindow)[key]
    const state = window.history.state as { __NA?: unknown } | null
    return probe !== undefined && state !== probe.startState && state?.__NA === true
  }, PROBE_KEY)
}
