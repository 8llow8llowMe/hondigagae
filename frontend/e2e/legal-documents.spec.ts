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
