import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { trackAppRouterMount, waitForAppRouterMounted } from './helpers/app-router'

/**
 * **인증 화면의 실패 표면** — 이슈 #1079.
 *
 * ### 왜 e2e 인가
 *
 * vitest 는 마크업 문자열만 본다 (`testing-guide.md` §1). 여기서 잠그는 것은 **실제 좌표**다:
 *
 * - 소셜 콜백 제목이 인증 카드의 글줄에 서는가. 예전에는 카드 안 `EmptyState` 가 자기 여백을
 *   한 번 더 먹어 제목이 x=49 였다(375 · 다른 인증 화면은 33).
 * - 로그인 5xx 에서 일시 장애 표시가 폼을 얼마나 미는가. 예전에는 `ErrorState`(세로 48 × 2)와
 *   `FormAlert` 가 함께 서서 폼이 약 250px 밀려 375 에서 소셜 버튼이 접힘선 밑으로 갔다.
 *
 * 세션 없이 시작한다 — 세션이 있으면 인증 화면이 목적지로 보낸다 (#1082).
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.beforeEach(async ({ page }) => {
  await trackAppRouterMount(page)
})

const PHONE = { width: 375, height: 812 } as const

/** 백엔드 공통 래퍼의 실패 봉투 — `src/lib/api/response.ts` 가 판별한다 */
function failure(status: number, resultCode: string, resultMessage: string) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      dataHeader: { success: false, resultCode, resultMessage },
      dataBody: null,
    }),
  }
}

/** 인증 카드(`<main>`) 안쪽 글줄의 왼쪽 x — 테두리 + 왼쪽 패딩 */
async function cardContentLeft(page: Page): Promise<number> {
  return page.locator('main').evaluate((main) => {
    const style = getComputedStyle(main)
    return (
      main.getBoundingClientRect().left +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.paddingLeft)
    )
  })
}

async function expectOnCardLine(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { level: 1 })
  const box = await heading.boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs((box?.x ?? 0) - (await cardContentLeft(page)))).toBeLessThanOrEqual(1)
}

test.describe('소셜 콜백 실패 화면 (#1079)', () => {
  for (const viewport of [PHONE, { width: 1440, height: 900 }]) {
    test(`${viewport.width} — 잘못된 접근: h1 이 카드 글줄에 서고 로그인 화면으로 간다`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await page.goto('/oauth/kakao/callback')

      await expect(
        page.getByRole('heading', { level: 1, name: messages.auth.oauthInvalidTitle }),
      ).toBeVisible()
      await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: messages.auth.oauthToLoginScreen }),
      ).toHaveAttribute('href', '/login')
      await expectOnCardLine(page)
    })
  }

  const FAILURES = [
    {
      label: 'email-denied (AUTH_009)',
      response: failure(400, 'AUTH_009', '소셜 계정의 이메일 제공 동의가 필요합니다.'),
      message: '소셜 계정의 이메일 제공 동의가 필요합니다.',
    },
    {
      label: '제공자 통신 불가 (AUTH_014 · 502)',
      response: failure(
        502,
        'AUTH_014',
        '소셜 로그인 제공자와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.',
      ),
      message: '소셜 로그인 제공자와 통신할 수 없습니다.',
    },
  ] as const

  for (const { label, response, message } of FAILURES) {
    test(`${label}: 같은 모양 — h1 · 서버 사유 · 로그인 화면으로`, async ({ page }) => {
      await page.setViewportSize(PHONE)
      await page.route('**/api/bff/auth/kakao/login**', (route) => route.fulfill(response))
      await page.goto('/oauth/kakao/callback?code=e2e&state=e2e')

      await expect(
        page.getByRole('heading', { level: 1, name: messages.auth.oauthFailedTitle }),
      ).toBeVisible()
      await expect(page.getByText(message)).toBeVisible()
      // 5xx 도 알림 상자가 아니다 — 예전에는 제목 없이 FormAlert 였다
      await expect(page.locator('[data-form-alert]')).toHaveCount(0)
      const link = page.getByRole('link', { name: messages.auth.oauthToLoginScreen })
      await expect(link).toHaveAttribute('href', '/login')
      await expect(page.getByRole('link', { name: /다시 시도/ })).toHaveCount(0)
      await expectOnCardLine(page)
    })
  }
})

test.describe('로그인 5xx (#1079)', () => {
  test('375 — 일시 장애 하나만 서고 소셜 버튼이 접힘선 위에 남는다', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.route('**/api/bff/auth/login', (route) =>
      route.fulfill(failure(503, 'COMMON_503', '서비스를 일시적으로 사용할 수 없습니다.')),
    )
    await page.goto('/login')
    // 입력·제출이 React 에 닿으려면 hydration 이 끝나야 한다 — 마운트 표식으로 기다린다 (#1103)
    await waitForAppRouterMounted(page)

    const kakao = page.getByRole('button', { name: messages.auth.socialLoginLabel('카카오') })
    const before = await kakao.boundingBox()

    await page.locator('#email').fill('demo@hondigagae.dev')
    await page.locator('#password').fill('password123!')
    await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()
    await expect(page.locator('[data-form-temporary-error]')).toBeVisible()
    await expect(page.locator('[data-form-alert]')).toHaveCount(0)

    // 제출 뒤 포커스가 표시로 옮겨 가며 스크롤될 수 있다 — 문서 좌표로 잰다
    const after = await kakao.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return { y: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY }
    })

    expect(before).not.toBeNull()
    expect(after.bottom).toBeLessThanOrEqual(PHONE.height)
    /*
      밀린 거리는 표시 하나의 높이다 — 2026-10-01 실측 101px(제목 · 설명 · 버튼 + 간격). 예전에는
      `ErrorState` 의 세로 48 × 2 와 `FormAlert` 가 함께 서서 약 250px 이었다. 여백이 돌아오거나
      알림이 다시 함께 서면 이 상한을 넘는다.
    */
    expect(after.y - (before?.y ?? 0)).toBeLessThanOrEqual(120)
  })
})
