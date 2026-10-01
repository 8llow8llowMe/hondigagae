import { expect, type Page, test } from '@playwright/test'

/**
 * **로그인한 채 인증 화면에 오면 안내 대신 목적지로 간다** (#1082).
 *
 * `/login` · `/signup` · `/signup/social/[provider]` 는 세션이 있으면 서버에서
 * `redirect(safeReturnTo(returnTo))` 한다. 목적지 규칙은 vitest 가 페이지를 직접 불러 본다
 * (`app/(auth)/authed-redirect.test.ts`). 여기서 보는 것은 **브라우저에서만 생기는 것**이다.
 *
 * 1. **HTTP 로 실제 307 이 나가는가.** `(auth)` 에 `loading.tsx` 가 없어서 가능한 일이다 —
 *    경계가 있으면 응답이 먼저 스트리밍돼 200 으로 굳고 리다이렉트는 클라이언트에서야 일어난다.
 * 2. **클라이언트 이동으로 와도 가는가.** 링크를 누르면 문서가 아니라 RSC 요청이 나가고,
 *    그 응답의 리다이렉트를 Next 라우터가 따라간다. #1075 가 라우터 캐시 때문에 깨졌던
 *    바로 그 경로라 문서 이동과 따로 본다.
 * 3. **리다이렉트가 캐시에 남아 로그아웃 뒤의 로그인 화면을 막지 않는가.** 계정 메뉴의
 *    로그아웃은 `router.replace('/')` + `refresh()` 로 **문서를 바꾸지 않는다.** 로그인 상태에서
 *    `/login` 으로 클라이언트 이동한 기록이 "`/login` → 홈" 으로 남으면, 로그아웃 뒤 헤더의
 *    `로그인` 이 로그인 화면 대신 홈으로 튕길 수 있다.
 *
 * ### 클라이언트 이동을 `window.next.router.push` 로 만든다
 *
 * **로그인 상태의 화면에는 `/login` 으로 가는 링크가 없다** — 헤더의 `로그인` 은 비로그인
 * 갈래에만 서고(`global-header.tsx`), 인증 화면 안의 링크는 이제 그 화면에 닿기 전에 리다이렉트된다.
 * 그래서 `next/link` 가 부르는 것과 같은 라우터 인스턴스의 `push` 를 직접 부른다. 문서가 바뀌지
 * 않았다는 것은 창에 심어 둔 표식이 살아 있는지로 확인한다.
 *
 * ### 부르기 전에 라우터가 **마운트**됐는지 기다린다 (#1094)
 *
 * `window.next.router` 는 **hydration 전에도 있다** — 모듈이 로드될 때 심긴다
 * (`next/dist/client/components/app-router-instance.js`). 그런데 `push` 가 실제로 쓰는
 * dispatch 는 hydration **렌더** 중에 심기고, 그 dispatch 가 부르는 `setState` 는 **커밋**
 * 뒤에야 받아들여진다. 그 사이에 부르면 React 가 "Can't perform a React state update on a
 * component that hasn't mounted yet" 을 남기고 업데이트를 **버린다** — RSC 요청은 나가고
 * 서버는 307(`NEXT_REDIRECT;replace;/`)로 답하는데 화면과 URL 은 출발점에 머문다.
 *
 * `main` 이 보이는 것은 **서버 HTML** 이라 hydration 신호가 아니다. 로컬에서는 hydration 이
 * 빨라 늘 통과했고, 느린 CI(Turbopack dev)에서 재시도까지 깨졌다. CPU 를 6배 늦추면 로컬에서도
 * 10회 중 8회 같은 경고와 함께 깨진다.
 *
 * 마운트 신호는 **`history.state.__NA`** 다. 앱 라우터의 `HistoryUpdater` 가 커밋 때
 * (`useInsertionEffect`) 현재 항목에 남기는 표식이라, 이것이 있으면 dispatch 의 주인이
 * 마운트돼 있다. `networkidle` 은 "500ms 동안 요청이 없다" 는 추정이라 고르지 않았다.
 *
 * **사용자에게는 생기지 않는다.** hydration 전의 링크 클릭은 `next/link` 의 핸들러가 아직 없어
 * 브라우저가 문서째 이동하고, 그 요청은 307 로 간다(첫 테스트가 본다). 앱 코드의 `router.push` 는
 * 이벤트 핸들러·effect 안에서만 불려 마운트 뒤다. 라우터를 마운트 전에 부를 수 있는 것은
 * 창에서 직접 부르는 이 헬퍼뿐이다.
 */

type NextWindow = Window & {
  next?: { router?: { push: (href: string) => void } }
  __noReload?: true
}

/** 문서를 바꾸지 않고 Next 라우터로 이동한다 — 표식이 살아 있으면 클라이언트 이동이었다 */
async function clientPush(page: Page, href: string) {
  // 마운트 전에 부르면 push 가 버려진다 (#1094, 위 주석)
  await page.waitForFunction(
    () => (window.history.state as { __NA?: unknown } | null)?.__NA === true,
  )
  await page.evaluate((target) => {
    const w = window as NextWindow
    w.__noReload = true
    const router = w.next?.router
    if (router === undefined) throw new Error('window.next.router 가 없다')
    router.push(target)
  }, href)
}

async function stayedInDocument(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as NextWindow).__noReload === true)
}

test.describe('로그인한 채 인증 화면에 오면 (#1082)', () => {
  test('/login 은 307 로 returnTo 에 보낸다', async ({ page }) => {
    const response = await page.goto('/login?returnTo=%2Fmypage')

    await expect(page).toHaveURL(/\/mypage$/)
    // 클라이언트에서 뒤늦게 옮긴 것이 아니라 서버가 문서 요청에 307 로 답했다
    const first = response?.request().redirectedFrom()
    expect(first?.url()).toMatch(/\/login\?returnTo=%2Fmypage$/)
    expect((await first?.response())?.status()).toBe(307)

    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('이미 로그인되어 있어요')).toHaveCount(0)
  })

  /* 쿼리는 사용자가 조작할 수 있다. 그대로 보내면 오픈 리다이렉트다 */
  test('외부 주소 returnTo 는 같은 오리진의 홈으로 좁힌다', async ({ page, baseURL }) => {
    await page.goto('/login?returnTo=https%3A%2F%2Fevil.example%2Fphish')

    await expect(page).toHaveURL(`${baseURL}/`)
  })

  test('/signup 도 returnTo 로 보낸다', async ({ page }) => {
    await page.goto('/signup?returnTo=%2Ffavorites')

    await expect(page).toHaveURL(/\/favorites$/)
  })

  test('소셜 가입 동의도 가입 동의를 다시 묻지 않고 보낸다', async ({ page, baseURL }) => {
    await page.goto('/signup/social/kakao')

    await expect(page).toHaveURL(`${baseURL}/`)
  })

  test('클라이언트 이동으로 와도 returnTo 로 간다 — 두 번째도 같다', async ({ page }) => {
    await page.goto('/mypage')
    await expect(page.getByRole('main')).toBeVisible()

    await clientPush(page, '/login?returnTo=%2Ffavorites')
    await expect(page).toHaveURL(/\/favorites$/)
    expect(await stayedInDocument(page)).toBe(true)

    /*
      **두 번째 이동은 라우터 캐시를 탈 수 있다.** 첫 리다이렉트의 기록이 남아 있으면 요청 없이
      그것을 쓰는데, 그 기록이 "로그인 화면" 으로 남았다면 여기서 드러난다.
    */
    await clientPush(page, '/mypage')
    await expect(page).toHaveURL(/\/mypage$/)
    await clientPush(page, '/login?returnTo=%2Ffavorites')
    await expect(page).toHaveURL(/\/favorites$/)
    expect(await stayedInDocument(page)).toBe(true)
    await expect(page.locator('#email')).toHaveCount(0)
  })

  test('리다이렉트 기록이 로그아웃 뒤의 로그인 화면을 막지 않는다', async ({ page, baseURL }) => {
    /*
      **홈이 아니라 마이페이지에서 출발한다.** 홈에서 출발하면 리다이렉트 목적지(홈)와 출발점이
      같아 `toHaveURL('/')` 이 이동이 끝나기 전에 통과하고, 진행 중인 전환이 계정 메뉴를 다시
      그려 열린 메뉴를 닫는다 (동시 실행에서 실제로 났다).
    */
    await page.goto('/mypage')
    await expect(page.getByRole('main')).toBeVisible()
    await clientPush(page, '/login')
    await expect(page).toHaveURL(`${baseURL}/`)

    // 계정 메뉴 로그아웃 — 문서를 바꾸지 않는다 (`account-menu.tsx`)
    await page.getByRole('button', { name: '내 정보 메뉴 열기' }).click()
    await page.getByRole('menuitem', { name: '로그아웃' }).click()
    const loginLink = page.locator('header').getByRole('link', { name: '로그인', exact: true })
    await expect(loginLink.first()).toBeVisible()

    await loginLink.first().click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator('#email')).toBeVisible()
    expect(await stayedInDocument(page)).toBe(true)
  })
})
