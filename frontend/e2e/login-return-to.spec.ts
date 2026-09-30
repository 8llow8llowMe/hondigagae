import { expect, test } from '@playwright/test'

/**
 * **클라이언트 이동으로 로그인 화면에 온 뒤 로그인하면 `returnTo` 로 간다** (#1075).
 *
 * vitest 로는 잡을 수 없던 결함이다 — 원인이 Next 클라이언트 라우터 캐시라 브라우저에서만
 * 생긴다. 비로그인으로 `반려견 등록하기`(`/pets/new`)를 누르면 proxy 가 로그인으로 보내고,
 * 캐시에 `/pets/new` 의 트리가 **로그인 화면**으로 남는다. 그 뒤 `router.replace('/pets/new')`
 * 는 요청 없이 로그인 화면에 머물렀고 `router.refresh()` 가 그 자리를 새 쿠키로 다시 그려
 * "이미 로그인되어 있어요" 가 떴다 (`enter-session.ts`).
 *
 * **주소창으로 `/pets/new` 에 들어가면 재현되지 않는다** — 문서째 받아 캐시가 비어 있다.
 * 그래서 이 스펙은 반드시 화면 안의 링크를 눌러 들어간다.
 */
test.describe('로그인 뒤 복귀 (#1075)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('소개 화면의 반려견 등록하기로 로그인하면 반려견 등록 화면이 열린다', async ({ page }) => {
    await page.goto('/about')
    await page.getByRole('link', { name: '반려견 등록하기' }).first().click()
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fpets%2Fnew$/)

    // 목 저장소의 일반 계정이다 — `auth.setup.ts` 의 MOCK_ACCOUNT 와 같다 (src/lib/api/mock/store.ts)
    await page.locator('#email').fill('demo@hondigagae.dev')
    await page.locator('#password').fill('password123!')
    await page.getByRole('button', { name: '로그인', exact: true }).click()

    await expect(page).toHaveURL(/\/pets\/new$/)
    await expect(page.getByText('이미 로그인되어 있어요')).toHaveCount(0)
    // #1013 이 막으려던 것 — 헤더가 비로그인 모양으로 남지 않는다
    await expect(page.getByRole('button', { name: '내 정보 메뉴 열기' })).toBeVisible()
    await expect(page.locator('header a[href="/login"]')).toHaveCount(0)
  })
})
