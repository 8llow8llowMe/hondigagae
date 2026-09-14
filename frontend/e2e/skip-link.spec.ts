import { expect, test } from '@playwright/test'

/**
 * **전역 스킵 링크가 실제로 본문에 **포커스**를 옮기는지** (이슈 #558).
 *
 * dev 실측에서 `/` · `/places?view=list` · `/plans` · `/plans/new` · `/mypage` 전부
 * Tab → Enter 뒤 `document.activeElement` 가 `BODY` 로 남았다. 원인은 목적지 `#main` 이
 * `tabindex` 없는 `div` 라 **포커스를 받을 수 없는 요소**였다는 것이다. 같은 문서의
 * `#place-list`(`SurfaceStack tabIndex={-1}`)는 정상이라 패턴이 아니라 누락이었다.
 *
 * **vitest 로는 잡을 수 없는 갈래다.** `environment: 'node'` 라 마크업 문자열만 보고
 * (`docs/testing-guide.md §1`) 포커스는 브라우저 안에만 있다. 마크업에 속성이 있는지는
 * `src/components/main-layout-surface.test.ts` 가 따로 잠근다 — 여기서는 **결과**를 잰다.
 *
 * **`activeElement` 를 직접 읽는 이유**는 Chromium 이 `tabindex` 없이도 **순차 포커스
 * 시작점**만은 옮겨 주기 때문이다 (`src/components/surface.tsx` 의 `SurfaceStack` 주석).
 * "다음 Tab 이 본문 안으로 들어간다" 로 단언하면 고치기 전에도 통과해 **아무것도
 * 잡지 못한다.** 포커스가 실제로 `#main` 에 앉았는지만이 두 경우를 가른다.
 */
const SCREENS = ['/', '/places?view=list', '/plans', '/plans/new', '/mypage'] as const

test.describe('본문으로 바로가기', () => {
  for (const path of SCREENS) {
    test(`${path} 에서 Tab → Enter 가 본문으로 포커스를 옮긴다`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()

      // 문서의 첫 포커스 대상이 스킵 링크다 — 헤더 앞에 둔 이유가 그것이다 (D6)
      await page.keyboard.press('Tab')
      await expect(page.locator('a:focus')).toHaveText('본문으로 바로가기')

      await page.keyboard.press('Enter')

      // 포커스가 `body` 에 남지 않고 `#main` 에 앉는다
      await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe('main')
    })
  }
})
