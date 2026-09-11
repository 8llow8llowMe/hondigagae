import { expect, test } from '@playwright/test'

import { PROTECTED_PATHS } from '../proxy'

/**
 * **보호 라우트가 실제로 막히고, 로그인하면 실제로 열리는지.**
 *
 * vitest 로는 확인할 수 없던 갈래다 — `proxy.ts` 는 미들웨어라 렌더 테스트가 닿지 않고,
 * 307 뒤의 화면은 마크업 문자열로 볼 수 없다. `auth-guide.md §5` 는 "화면을 추가하면
 * `PROTECTED_PATHS` 에도 넣는다. 빼먹으면 로그인 없이 접근된다" 고 적어 두었는데,
 * 그 빠뜨림을 잡아 주는 것이 지금까지 없었다 (이슈 #467).
 *
 * **목록을 `proxy.ts` 에서 직접 읽는다.** 여기 베껴 두면 둘이 갈릴 때 테스트가 먼저
 * 낡는다 — 경로가 늘면 이 스펙이 자동으로 함께 늘어야 한다.
 */
test.describe('보호 라우트', () => {
  test.describe('세션 없이', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    for (const path of PROTECTED_PATHS) {
      test(`${path} 는 returnTo 를 달고 로그인으로 보낸다`, async ({ page }) => {
        await page.goto(path)

        await expect(page).toHaveURL(
          new RegExp(`/login\\?returnTo=${encodeURIComponent(path).replace(/\//g, '%2F')}$`),
        )
      })
    }
  })

  test.describe('세션이 있으면', () => {
    for (const path of ['/mypage', '/pets', '/favorites'] as const) {
      test(`${path} 가 그대로 열린다`, async ({ page }) => {
        await page.goto(path)

        await expect(page).toHaveURL(new RegExp(`${path}$`))
        // 리다이렉트만 안 났다고 화면이 선 것은 아니다 — 랜드마크까지 확인한다
        await expect(page.getByRole('main')).toBeVisible()
      })
    }
  })
})
