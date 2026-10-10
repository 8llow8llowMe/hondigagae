import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * **반려견 폼의 5xx 실패 표면** — 이슈 #1101.
 *
 * 예전에는 등록 · 수정 저장이 5xx 로 끝나면 일시 장애 `ErrorState` 아래에 서버 문구 `FormAlert`
 * 가 또 섰다(`apiErrorToFormErrors` 가 5xx 에도 `form` 을 채운다). 인증 폼(#1079)과 같은
 * `FormFailure` 한 자리로 줄였다.
 *
 * ### 왜 e2e 인가
 *
 * 표시가 하나인지는 vitest(`pet-form.test.ts`)가 마크업으로 본다. 여기서 잠그는 것은 마크업에
 * 없는 둘이다:
 *
 * - **포커스** — 제출 중 버튼이 `disabled` 가 되며 포커스가 `BODY` 로 떨어진다. 5xx 뒤에는
 *   일시 장애 상자(`data-form-temporary-error`)로 돌아와야 한다 (`focusSubmitFailure`).
 * - **세로선** — 일시 장애가 `flush` 라 폼 필드와 같은 왼쪽 선에 선다. 예전 `inset="card"` 는
 *   호출부가 이미 두른 카드 인셋을 한 번 더 먹었다.
 *
 * 세션은 `auth.setup.ts` 의 storageState 다(보호 라우트). 수정 화면은 목 저장소의 첫 반려견이다.
 */
const SEED_PET_ID = '123456789012000001'

/** 백엔드 공통 래퍼의 실패 봉투 — `src/lib/api/response.ts` 가 판별한다 */
const UNAVAILABLE = {
  status: 503,
  contentType: 'application/json',
  body: JSON.stringify({
    dataHeader: {
      success: false,
      resultCode: 'COMMON_503',
      resultMessage: '서비스를 일시적으로 사용할 수 없습니다.',
    },
    dataBody: null,
  }),
}

const SCREENS = [
  {
    name: '등록',
    path: '/pets/new',
    method: 'POST',
    api: '**/api/bff/members/me/pets',
    submit: messages.pet.register,
  },
  {
    name: '수정',
    path: `/pets/${SEED_PET_ID}`,
    method: 'PUT',
    api: `**/api/bff/members/me/pets/${SEED_PET_ID}`,
    submit: messages.pet.save,
  },
] as const

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
] as const

async function blockSave(page: Page, api: string, method: string): Promise<void> {
  await page.route(api, (route) =>
    route.request().method() === method ? route.fulfill(UNAVAILABLE) : route.fallback(),
  )
}

for (const screen of SCREENS) {
  for (const viewport of VIEWPORTS) {
    test(`${screen.name} ${viewport.width} — 503 이면 일시 장애 하나만 서고 포커스가 그 상자로 간다`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await blockSave(page, screen.api, screen.method)
      await page.goto(screen.path)
      await page.waitForLoadState('networkidle')

      const name = page.locator('#name')
      await name.fill('콩이')
      // 등록 폼은 크기를 고르지 않은 채 시작한다(#1185) — 저장 실패 갈래까지 가려면 골라야 한다
      if (screen.method === 'POST') await page.locator('#sizeType-SMALL').check()
      await page.getByRole('button', { name: screen.submit, exact: true }).click()

      const temporary = page.locator('main [data-form-temporary-error]')
      await expect(temporary).toHaveCount(1)
      await expect(temporary).toBeVisible()
      await expect(temporary.getByText(messages.common.temporaryErrorTitle)).toBeVisible()
      // 서버 문구 알림이 함께 서지 않는다 — 예전에는 그 아래에 또 섰다
      await expect(page.locator('main [data-form-alert]')).toHaveCount(0)
      await expect(page.getByText('서비스를 일시적으로 사용할 수 없습니다.')).toHaveCount(0)
      // 재시도 수단도 하나다
      await expect(page.getByRole('button', { name: messages.common.retry })).toHaveCount(1)

      // 제출 실패 뒤 포커스 — 재시도 버튼이 아니라 상자 전체 (submit-failure-focus.ts)
      await expect(temporary).toBeFocused()

      // 카드 제목(`h2`) 안이라 한 단 내린다
      await expect(
        page.getByRole('heading', { level: 3, name: messages.common.temporaryErrorTitle }),
      ).toBeVisible()

      // `flush` — 폼 필드와 같은 왼쪽 세로선에 선다
      const boxLeft = (await temporary.boundingBox())?.x
      const fieldLeft = (await name.boundingBox())?.x
      expect(boxLeft).toBeDefined()
      expect(Math.abs((boxLeft ?? 0) - (fieldLeft ?? 0))).toBeLessThanOrEqual(1)

      // 값을 고치면 일시 장애가 걷힌다 (등록-세부명세 D4) — 폼은 대체되지 않아 그대로 고칠 수 있다
      await name.fill('콩이네')
      await expect(temporary).toHaveCount(0)
      await expect(name).toHaveValue('콩이네')
    })
  }
}
