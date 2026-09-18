import { expect, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * **404 탭 제목** — 이슈 #676.
 *
 * ### 왜 e2e 인가
 *
 * `export const metadata` 가 `not-found.tsx` 에서 실제로 먹는지는 **vitest 로 못 본다.**
 * 이 저장소의 vitest 는 `environment: 'node'` 라 모듈을 렌더하지 않고 소스 문자열만
 * 본다 (`docs/testing-guide.md` §1, `app/not-found.test.ts`) — `export const metadata` 가
 * 있다는 것은 잠그지만, Next 가 그 값을 실제 `<title>` 로 내보내는지는 런타임이라야 안다.
 *
 * **`<title>` 을 `curl`·원시 HTML 로 판정하지 않는다.** 초기 HTML 의 `<head>` 에는 셸
 * 기본값(`혼디가개`)이 들어 있고 진짜 제목은 스트림 뒤쪽 flight 청크로 와서 React 가
 * 바꿔 끼운다 (`docs/architecture-guide.md` §7). `page.goto` 뒤 `toHaveTitle` 은 Playwright
 * 가 하이드레이션까지 기다린 뒤의 값을 자동 재시도로 확인해 이 함정을 피한다.
 *
 * `places` 는 넣지 않는다 — 이미 `generateMetadata` 가 맞게 내고 있고 이 이슈의 수정
 * 범위 밖이다 (`docs/architecture-guide.md` §7 `not-found.tsx` 절).
 */
test.describe('404 탭 제목 (#676)', () => {
  test('전역 404 — 없는 주소예요 · 혼디가개', async ({ page }) => {
    await page.goto('/definitely-not-a-page')

    await expect(page).toHaveTitle(`${messages.common.notFoundTitle} · 혼디가개`)
  })

  test('일정 상세 404 — 찾을 수 없는 일정이에요 · 혼디가개', async ({ page }) => {
    await page.goto('/plans/123456789012999999')

    await expect(page).toHaveTitle(`${messages.plan.detailNotFoundTitle} · 혼디가개`)
  })

  test('반려견 상세 404 — 존재하지 않는 반려견이에요 · 혼디가개', async ({ page }) => {
    await page.goto('/pets/999999')

    await expect(page).toHaveTitle(`${messages.pet.notFoundTitle} · 혼디가개`)
  })
})
