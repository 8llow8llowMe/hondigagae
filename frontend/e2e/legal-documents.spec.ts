import { expect, test } from '@playwright/test'

/**
 * 약관·개인정보 처리방침 — 이슈 #610.
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 마크업이 아니라 **"가입하지 않은 사람이 읽을 수 있다"** 는 상태다.
 * 약관은 가입 **전에** 읽는 문서라, 보호 라우트로 새면 문서가 있으나 마나다.
 * `proxy.ts` 의 `PROTECTED_PATHS` 는 node 환경 렌더 테스트에 존재하지 않아 단위
 * 테스트로는 이 회귀를 잡을 수 없다.
 *
 * 목차 앵커도 여기서 잰다 — `scroll-mt` 와 `id` 가 실제로 맞물리는지는 브라우저만 안다.
 */
test.describe('약관 문서 — 로그아웃 상태 (#610)', () => {
  /* 가입 전 사용자를 재현한다 — 쿠키가 하나도 없는 컨텍스트다 */
  test.use({ storageState: { cookies: [], origins: [] } })

  test('로그인하지 않아도 이용약관이 열린다', async ({ page }) => {
    await page.goto('/terms')

    await expect(page).toHaveURL(/\/terms$/)
    await expect(page.getByRole('heading', { level: 1, name: '이용약관' })).toBeVisible()
  })

  test('로그인하지 않아도 개인정보 처리방침이 열린다', async ({ page }) => {
    await page.goto('/privacy')

    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole('heading', { level: 1, name: '개인정보 처리방침' })).toBeVisible()
  })

  test('푸터 링크로 약관에 닿는다', async ({ page }) => {
    /*
      **홈에서 출발한다.** 푸터는 `(main)` 레이아웃의 `AppShell` 이 그리므로 `(auth)`
      그룹(`/login` 등)에는 아예 없다. 홈은 `(main)` 이고, 보호 라우트가 아니며,
      지도로 뷰포트를 채우지 않는다.
    */
    await page.goto('/')

    await page
      .getByRole('navigation', { name: '약관' })
      .getByRole('link', { name: '이용약관' })
      .click()

    await expect(page).toHaveURL(/\/terms$/)
  })

  /* 목차만 있고 `id` 가 없으면 눌러도 아무 일이 안 난다 — 긴 문서에서 가장 티가 안 난다 */
  test('목차에서 조문으로 뛴다', async ({ page }) => {
    await page.goto('/terms')

    await page
      .getByRole('navigation', { name: '목차' })
      .getByRole('link', { name: /제12조/ })
      .click()

    await expect(page).toHaveURL(/#article-12$/)
    await expect(page.locator('#article-12')).toBeInViewport()
  })
})

/**
 * 목차 레일 — vitest 가 볼 수 없는 것만 잰다.
 *
 * 렌더 테스트는 DOM 순서와 클래스 문자열까지고, 그것이 실제로 2단이 되는지는
 * `.rail-layout-detail` 의 grid 배치와 `.rail-sticky` 가 정한다 (`app/globals.css`).
 * 그 둘은 브라우저만 안다 — `playwright.config.ts` 머리주석이 이 스펙의 경계다.
 */
test.describe('약관 문서 — 목차 레일', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('데스크톱에서 목차가 본문 왼쪽 열에 서고 굴러도 헤더 아래 남는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/privacy')

    const toc = page.getByRole('navigation', { name: '목차' })
    const body = page.locator('#article-1')

    const tocBox = await toc.boundingBox()
    const bodyBox = await body.boundingBox()
    if (tocBox === null || bodyBox === null) throw new Error('레일 또는 본문을 찾지 못했다')

    // 목차 오른쪽 끝이 본문 왼쪽 끝보다 앞이면 두 기둥이 겹치지 않는다
    expect(tocBox.x + tocBox.width).toBeLessThan(bodyBox.x)

    /*
      `.rail-sticky` 는 `top: var(--header-h)` 다. 굴린 뒤에도 그 값에 붙어 있어야
      "긴 문서를 내려가는 동안 목차가 남는다" 는 이 배치의 이유가 성립한다.
    */
    const before = (await toc.boundingBox())?.y
    await page.evaluate(() => window.scrollTo(0, 1500))
    await expect
      .poll(async () => Math.round((await toc.boundingBox())?.y ?? -1))
      .toBe(Math.round(before ?? -1))
  })

  /*
    **모바일에서 사라지지 않는다.** 가입 전 사용자가 제14조로 가는 유일한 지름길이고,
    `hidden lg:block` 은 렌더 테스트가 막지만 **한 컬럼에서 제목과 본문 사이에 선다**는
    것은 grid 가 풀렸을 때만 성립한다.
  */
  test('모바일에서 목차가 제목과 본문 사이 한 컬럼으로 선다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/privacy')

    const title = page.getByRole('heading', { level: 1, name: '개인정보 처리방침' })
    const toc = page.getByRole('navigation', { name: '목차' })
    const body = page.locator('#article-1')

    const titleBox = await title.boundingBox()
    const tocBox = await toc.boundingBox()
    const bodyBox = await body.boundingBox()
    if (titleBox === null || tocBox === null || bodyBox === null) {
      throw new Error('제목 · 목차 · 본문 중 하나를 찾지 못했다')
    }

    expect(tocBox.y).toBeGreaterThan(titleBox.y + titleBox.height)
    expect(bodyBox.y).toBeGreaterThan(tocBox.y + tocBox.height)

    /*
      **목차가 열이 아니라 전폭 블록이다.** `.rail-layout-detail` 의 grid 가 `lg` 아래에서
      풀리지 않으면 목차는 400px 짜리 좌측 열로 남고, y 순서만 재는 위 두 줄은 그래도
      통과한다 — 폭을 함께 봐야 "한 컬럼" 이 실제로 성립한다.

      `nav` 는 모바일 전폭 카드의 직계 자식이라 인셋 없이 카드 폭 그대로다.
    */
    expect(Math.round(tocBox.x)).toBe(0)
    expect(Math.round(tocBox.width)).toBe(390)
  })
})
