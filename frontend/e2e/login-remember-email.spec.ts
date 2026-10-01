import { expect, type Page, test } from '@playwright/test'

import { SAVED_LOGIN_EMAIL_STORAGE_KEY } from '../src/lib/auth/saved-login-email'
import { messages } from '../src/lib/messages'
import { trackAppRouterMount, waitForAppRouterMounted } from './helpers/app-router'

/**
 * **로그인 화면의 "이메일 기억하기"** — 로그인-세부명세 D10 (#1081).
 *
 * vitest 로는 못 보는 갈래만 여기서 잠근다: `localStorage` 가 실제로 쓰이고 지워지는
 * 시점과, 마운트 뒤 effect 가 채우는 값의 우선순위. 저장 · 판정 함수 자체는
 * `saved-login-email.test.ts` 가 본다.
 *
 * 세션 없이 시작한다 — 세션이 있으면 `/login` 이 폼을 그리지 않고 `returnTo` 로 리다이렉트한다 (#1082).
 */
const STORAGE_KEY = SAVED_LOGIN_EMAIL_STORAGE_KEY
const CAPTION = messages.auth.rememberEmailCaption

/**
 * `MOCK_API=true` 저장소의 일반 계정 (`src/lib/api/mock/store.ts`) — `auth.setup.ts` 의
 * `MOCK_ACCOUNT` 와 같은 값이다. **그 파일을 import 하지 않는다**: 최상위에서 `setup(...)`
 * 을 부르므로 가져오는 순간 이 스펙 안에 로그인 setup 이 한 번 더 등록된다.
 */
const MOCK_ACCOUNT = { email: 'demo@hondigagae.dev', password: 'password123!' } as const

test.use({ storageState: { cookies: [], origins: [] } })

test.beforeEach(async ({ page }) => {
  await trackAppRouterMount(page)
})

async function readSaved(page: Page): Promise<string | null> {
  return page.evaluate((key) => globalThis.localStorage.getItem(key), STORAGE_KEY)
}

/**
 * 저장값을 심고 다시 연다. 체크박스 · 이메일은 **마운트 뒤 effect** 가 채우므로, 값이
 * 들어온 것을 보는 것이 곧 hydration 이 끝났다는 신호다.
 */
async function openWithSaved(page: Page, saved: string, path = '/login'): Promise<void> {
  await page.goto('/login')
  await page.evaluate(([key, value]) => globalThis.localStorage.setItem(key, value), [
    STORAGE_KEY,
    saved,
  ] as const)
  await page.goto(path)
  await expect(page.locator('#remember-email')).toBeChecked()
}

test('체크를 켜고 로그인하면 로그아웃 뒤 재방문에 이메일이 채워진다', async ({ page }) => {
  await page.goto('/login')
  // 기본은 꺼짐 — 저장값이 없으면 켜지지 않는다
  await expect(page.locator('#remember-email')).not.toBeChecked()
  // 클릭이 React 에 닿으려면 hydration 이 끝나야 한다 — 마운트 표식으로 기다린다 (#1103)
  await waitForAppRouterMounted(page)

  await page.locator('#email').fill(MOCK_ACCOUNT.email)
  await page.locator('#password').fill(MOCK_ACCOUNT.password)
  await page.locator('#remember-email').check()
  await expect(page.getByText(CAPTION)).toBeVisible()
  // 켠 것만으로는 저장하지 않는다 — 로그인이 성공해야 남는다
  expect(await readSaved(page)).toBeNull()

  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
  expect(await readSaved(page)).toBe(MOCK_ACCOUNT.email)

  /*
    로그아웃은 기억을 남긴다 (#1081). **헤더 계정 메뉴로 나간다** — 세션이 있으면 `/login` 은
    서버 리다이렉트라 그 자리에 로그아웃 버튼이 없다 (#1082).
  */
  /*
    로그인 성공은 문서째 새로 받는다 (#1075) — 메뉴 버튼이 hydration 전에 눌리면 열리지 않는다.
    **새 문서의 마운트를 기다린다** (#1103). `location.replace` 로 열린 문서는 `history.state` 가
    비어 시작하므로 이전 문서의 `__NA` 에 속지 않는다 — 헬퍼가 그래도 시작 상태와 견준다.
  */
  await waitForAppRouterMounted(page)
  await page.getByRole('button', { name: '내 정보 메뉴 열기' }).click()
  await page.getByRole('menuitem', { name: messages.member.logout }).click()
  await expect(page.getByRole('button', { name: '내 정보 메뉴 열기' })).toHaveCount(0)

  await page.goto('/login')
  await expect(page.locator('#email')).toHaveValue(MOCK_ACCOUNT.email)
  await expect(page.locator('#remember-email')).toBeChecked()
  // 이메일이 채워져 오면 남은 일은 비밀번호다 (L1)
  await expect(page.locator('#password')).toBeFocused()
})

test('체크를 해제하면 로그인하지 않아도 즉시 지운다', async ({ page }) => {
  await openWithSaved(page, MOCK_ACCOUNT.email)
  expect(await readSaved(page)).toBe(MOCK_ACCOUNT.email)

  await page.locator('#remember-email').uncheck()

  expect(await readSaved(page)).toBeNull()
  await expect(page.getByText(CAPTION)).toHaveCount(0)
})

test('?email= 쿼리가 기억한 이메일보다 우선한다', async ({ page }) => {
  const queryEmail = 'just-signed-up@hondigagae.dev'

  await openWithSaved(page, MOCK_ACCOUNT.email, `/login?email=${encodeURIComponent(queryEmail)}`)

  await expect(page.locator('#email')).toHaveValue(queryEmail)
  // 기억하기를 켜 둔 선택은 그대로다 — 저장값은 로그인이 성공할 때까지 바뀌지 않는다
  await expect(page.locator('#remember-email')).toBeChecked()
  expect(await readSaved(page)).toBe(MOCK_ACCOUNT.email)
})
