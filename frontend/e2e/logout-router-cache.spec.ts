import { expect, type Page, test } from '@playwright/test'

/**
 * **로그아웃 뒤 로그인 때 받은 라우터 캐시가 직전 사용자 화면을 다시 그리지 않는다** (#1099).
 *
 * 로그아웃은 **문서를 바꾸지 않는 이동**이다 — 계정 메뉴(`account-menu.tsx`)와 마이페이지 ·
 * 비밀번호 변경 · 소셜 전용 전환 · 탈퇴(`use-session-exit.ts`) 모두 `router.replace` 뒤에
 * `router.refresh()` 를 부른다. 그래서 로그인 상태에서 받아 둔 Next 클라이언트 캐시가 같은
 * 문서 안에 그대로 있다. #1075 는 반대 방향(비로그인 때 받은 트리가 로그인 뒤 남음)이었다.
 *
 * ### 무엇이 남고 무엇이 비워지나 (next 16.3, 실측)
 *
 * - **route cache 는 남는다** — URL → 라우트 트리의 **모양**만 든다. 로그인 상태에서 받은
 *   `/plans` 의 트리는 비로그인에도 같은 `(main)/plans` 라 낡은 값이 아니다. 거기로 이동하면
 *   세그먼트 데이터를 **새로 요청하고**, 그 요청에서 proxy 가 307 로 로그인에 보낸다.
 * - **데이터는 segment cache 와 BFCache 에 있다.** BFCache 는 뒤로/앞으로 가기가 **요청 없이**
 *   다시 그리는 동적 데이터다(`segment-cache/bfcache.js` — 뒤로가기는 stale time 도 보지 않는다).
 *   서버 프리페치(`HydrationBoundary`)가 실린 RSC 라 직전 사용자의 일정 · 닉네임이 그대로 든다.
 * - **둘을 비우는 것이 `router.refresh()` 다** — `refresh-reducer.js` 가 segment cache 버전과
 *   `invalidateBfCache()` 를 올린다. 이 줄을 빼면 로그아웃 뒤 뒤로가기가 직전 사용자의 일정
 *   목록과 마이페이지(닉네임 · 이메일)를 요청 0건으로 그린다(목, 실측). 헤더도 로그인 모양으로
 *   남는다. **`refresh` 는 헤더만을 위한 줄이 아니다.**
 *
 * ### 화면 안 링크로 캐시를 채운다
 *
 * 주소창(`goto`)으로 다니면 문서가 매번 바뀌어 캐시가 비어 있다 — #1075 와 같은 이유다. 헤더 ·
 * 계정 메뉴의 링크를 눌러 다닌다. 누르기 전에 라우터 마운트(`history.state.__NA`)를 기다린다 —
 * hydration 전에 누르면 브라우저가 문서째 이동한다 (`docs/testing-guide.md` §12, #1094).
 *
 * **로그아웃 뒤의 앞으로 이동은 `window.next.router.push` 로 만든다.** 비로그인 화면의 보호 링크는
 * 처음부터 `/login?returnTo=…` 를 가리켜(`toLoginHref`) 캐시된 URL 을 다시 밟지 않는다. 캐시된
 * 그 URL 로 가는 것은 `next/link` 가 부르는 같은 라우터의 `push` 다.
 */

type NextWindow = Window & {
  next?: { router?: { push: (href: string) => void } }
  __noReload?: true
  __stale?: string[]
}

/** 로그인한 목 계정의 화면에만 있는 글자 — 닉네임 · 반려견 · 일정 제목 (`src/lib/api/mock/store.ts`) */
const PREVIOUS_USER_MARKERS = ['제주댕댕', '몽실이', '몽실이와 제주 2박 3일'] as const

/** 화면 안 링크로 지나간 보호 화면 — 히스토리에 이 순서로 쌓인다 */
const VISITED = ['/plans', '/favorites', '/pets'] as const

async function routerMounted(page: Page) {
  await page.waitForFunction(
    () => (window.history.state as { __NA?: unknown } | null)?.__NA === true,
  )
}

async function openAccountMenuItem(page: Page, name: string) {
  await routerMounted(page)
  await page.getByRole('button', { name: '내 정보 메뉴 열기' }).click()
  await page.getByRole('menuitem', { name }).click()
}

/** 홈에서 출발해 화면 안 링크로만 보호 화면을 돌고 마이페이지에 선다 */
async function fillRouterCacheWhileLoggedIn(page: Page) {
  await page.goto('/')
  await routerMounted(page)
  // 이 문서가 끝까지 유지되는지 — 끊기면 캐시를 시험한 것이 아니다
  await page.evaluate(() => {
    ;(window as NextWindow).__noReload = true
  })

  await page.locator('header').getByRole('link', { name: '여행 일정' }).click()
  await expect(page).toHaveURL(/\/plans$/)
  await expect(page.getByText('몽실이와 제주 2박 3일').first()).toBeVisible()

  await openAccountMenuItem(page, '저장한 장소')
  await expect(page).toHaveURL(/\/favorites$/)

  await openAccountMenuItem(page, '내 반려견')
  await expect(page).toHaveURL(/\/pets$/)

  await openAccountMenuItem(page, '마이페이지')
  await expect(page).toHaveURL(/\/mypage$/)
  await expect(page.getByText('제주댕댕', { exact: true })).toBeVisible()
  await routerMounted(page)
}

/**
 * 로그아웃이 끝난 뒤부터 직전 사용자 표식이 **한 프레임이라도** 그려지는지 기록한다.
 * 단언 시점의 화면만 보면 "잠깐 그렸다가 로그인으로 간" 경우를 놓친다.
 */
async function watchForPreviousUser(page: Page) {
  await page.evaluate((markers) => {
    const w = window as NextWindow
    w.__stale = []
    const check = () => {
      const text = document.body.innerText
      for (const marker of markers)
        if (text.includes(marker)) w.__stale?.push(`${location.pathname}:${marker}`)
    }
    check()
    new MutationObserver(check).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  }, PREVIOUS_USER_MARKERS)
}

async function previousUserSightings(page: Page): Promise<string[] | undefined> {
  return page.evaluate(() => (window as NextWindow).__stale)
}

async function stayedInDocument(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as NextWindow).__noReload === true)
}

/** proxy 가 보호 경로를 보내는 자리 — `/plans` → `/login?returnTo=%2Fplans` */
function loginGate(pathname: string): RegExp {
  return new RegExp(`/login\\?returnTo=${encodeURIComponent(pathname)}$`)
}

/** RSC 요청이 실제로 나갔는지 — 캐시로 그렸다면 요청이 없다 */
function rscRequestFor(page: Page, pathname: string) {
  return page.waitForRequest(
    (request) => new URL(request.url()).pathname === pathname && request.headers()['rsc'] === '1',
  )
}

/** 뒤로가기로 로그아웃 전 보호 화면에 돌아가면 서버에 다시 묻고 로그인 화면에 선다 */
async function expectBackReachesLoginGate(page: Page) {
  for (const pathname of [...VISITED].reverse()) {
    const request = rscRequestFor(page, pathname)
    await page.goBack()
    await request
    await expect(page).toHaveURL(loginGate(pathname))
    await expect(page.locator('#email')).toBeVisible()
  }
}

test.describe('로그아웃 뒤 라우터 캐시 (#1099)', () => {
  test('계정 메뉴 로그아웃 뒤 뒤로가기는 직전 사용자 화면을 그리지 않는다', async ({ page }) => {
    await fillRouterCacheWhileLoggedIn(page)

    await openAccountMenuItem(page, '로그아웃')
    await expect(page).toHaveURL(/\/$/)
    // 로그아웃이 끝났다는 신호 — `refresh` 가 헤더를 비로그인으로 다시 그렸다
    await expect(
      page.locator('header').getByRole('link', { name: '로그인', exact: true }).first(),
    ).toBeVisible()
    await watchForPreviousUser(page)

    await expectBackReachesLoginGate(page)

    expect(await previousUserSightings(page)).toEqual([])
    expect(await stayedInDocument(page)).toBe(true)
  })

  test('계정 메뉴 로그아웃 뒤 캐시된 보호 경로로 가면 새로 요청해 로그인으로 간다', async ({
    page,
  }) => {
    await fillRouterCacheWhileLoggedIn(page)

    await openAccountMenuItem(page, '로그아웃')
    await expect(
      page.locator('header').getByRole('link', { name: '로그인', exact: true }).first(),
    ).toBeVisible()
    await watchForPreviousUser(page)

    for (const pathname of [...VISITED, '/mypage']) {
      const request = rscRequestFor(page, pathname)
      await routerMounted(page)
      await page.evaluate((href) => {
        const router = (window as NextWindow).next?.router
        if (router === undefined) throw new Error('window.next.router 가 없다')
        router.push(href)
      }, pathname)
      await request
      await expect(page).toHaveURL(loginGate(pathname))
      await expect(page.locator('#email')).toBeVisible()
    }

    expect(await previousUserSightings(page)).toEqual([])
    expect(await stayedInDocument(page)).toBe(true)
  })

  /* `useSessionExit` 경로 — 비밀번호 변경 · 소셜 전용 전환 · 탈퇴가 같은 함수를 지난다 */
  test('마이페이지 로그아웃 뒤 뒤로가기도 직전 사용자 화면을 그리지 않는다', async ({ page }) => {
    await fillRouterCacheWhileLoggedIn(page)

    await page.locator('main').getByRole('button', { name: '로그아웃' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '로그아웃' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator('#email')).toBeVisible()
    await watchForPreviousUser(page)

    await expectBackReachesLoginGate(page)

    expect(await previousUserSightings(page)).toEqual([])
    expect(await stayedInDocument(page)).toBe(true)
  })
})
