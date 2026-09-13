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

/**
 * **전역 404 — 주소가 어느 라우트와도 안 맞을 때** (#494).
 *
 * 이것이 없을 때는 Next 기본 화면(`404 / This page could not be found.`)이 그대로 떴다 —
 * 영문이고 헤더·푸터·돌아갈 링크가 없어 **뒤로가기 말고 할 수 있는 일이 없었다.**
 *
 * **여기(보호 라우트 스펙)에 두는 이유**는 둘이 같은 자리에서 갈리기 때문이다. 보호 경로
 * 아래의 없는 주소는 **미로그인이면 404 가 아니라 로그인으로** 가야 한다 — 라우트가 있는지
 * 없는지를 미로그인 사용자에게 흘리지 않는 쪽이 맞다. 한 파일에서 두 갈래를 나란히 잠근다.
 */
test.describe('전역 404', () => {
  const MISSING = '/no-such-page-zzz'

  test('없는 주소가 HTTP 404 로 응답한다 — soft 200 이 아니다', async ({ page }) => {
    const response = await page.goto(MISSING)

    expect(response?.status()).toBe(404)
  })

  test('앱 셸과 돌아갈 길이 함께 나온다 — 한국어다', async ({ page }) => {
    await page.goto(MISSING)

    // 셸 — `(main)` 그룹 레이아웃이 닿지 않는 자리라 `AppShell` 이 직접 그린다
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.locator('.site-footer')).toBeVisible()

    // 돌아갈 곳 둘
    await expect(page.getByRole('main').getByRole('link', { name: '홈으로' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: '장소 찾기' })).toBeVisible()

    // Next 기본 영문 화면이 아니다
    await expect(page.getByRole('main')).not.toContainText('This page could not be found')
  })

  /*
    **가장 짧은 화면이라 세로 뼈대가 여기서 가장 먼저 깨진다** (#456③). 셸을 `(main)`
    레이아웃에서 뽑아낼 때 `min-h-dvh` + `flex-1` 짝을 한 벌로 유지했는지가 이 단언이다 —
    한쪽만 남으면 푸터 아래로 흰 띠가 생긴다.
  */
  test('바닥이 뷰포트 끝까지 이어지고 없던 스크롤이 생기지 않는다', async ({ page }) => {
    await page.goto(MISSING)

    const geometry = await page.evaluate(() => {
      const round = (value: number) => Math.round(value)
      const footer = document.querySelector('.site-footer')?.getBoundingClientRect()
      const canvas = document.querySelector('main')?.getBoundingClientRect()
      return {
        viewport: window.innerHeight,
        doc: document.documentElement.scrollHeight,
        canvasBottom: round(canvas?.bottom ?? -1),
        footerTop: round(footer?.top ?? -1),
        footerBottom: round(footer?.bottom ?? -1),
      }
    })

    expect(geometry.canvasBottom).toBe(geometry.footerTop)
    expect(geometry.footerBottom).toBe(geometry.viewport)
    expect(geometry.doc).toBe(geometry.viewport)
  })

  test('세션이 있으면 보호 경로 아래의 없는 주소도 404 다', async ({ page }) => {
    const response = await page.goto('/pets/no-such-sub-page-zzz/deeper')

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('main').getByRole('link', { name: '홈으로' })).toBeVisible()
  })

  test.describe('세션 없이', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    /*
      **404 보다 로그인이 먼저다.** 미들웨어가 경로 접두사로만 판정하므로 그 아래 라우트가
      실재하는지와 무관하게 막힌다 — 라우트의 존재 여부를 미로그인 사용자에게 흘리지 않는다.
    */
    test('보호 경로 아래의 없는 주소는 404 가 아니라 로그인으로 간다', async ({ page }) => {
      await page.goto('/pets/no-such-sub-page-zzz/deeper')

      await expect(page).toHaveURL(/\/login\?returnTo=/)
    })

    test('보호 경로 밖의 없는 주소는 그대로 404 다', async ({ page }) => {
      const response = await page.goto(MISSING)

      expect(response?.status()).toBe(404)
      await expect(page.getByRole('main').getByRole('link', { name: '홈으로' })).toBeVisible()
    })
  })
})
