import { expect, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * **일정 항목 수 상한(`PLAN_028`)이 담기 시트에서 상한 문구로 보인다** — 이슈 #1251 (BE #1243).
 *
 * ### 왜 e2e 인가
 *
 * 분류(`toPlanDaySaveError`)는 단위 테스트가 있다. 여기서 지키는 것은 그 분류가 **실제 담기
 * 시트의 알림 자리까지** 가는 한 바퀴다 — 예전에는 "나머지 4xx" 로 떨어져 새로고침 안내가 나갔고,
 * 새로고침해도 같은 400 이 되풀이됐다.
 *
 * ### 무엇으로 고정하나
 *
 * 목 저장소는 상한을 검사하지 않는다 — 100개를 실제로 채우는 대신 **교체 요청만** `page.route`
 * 로 400 `PLAN_028` 에 묶는다. 응답 모양은 `PlanErrorCode.PLAN_ITEM_LIMIT_EXCEEDED`(도메인 예외 —
 * `fieldErrors` 없음) 실측이다.
 */
test.describe('담기 시트의 항목 수 상한 (#1251)', () => {
  test('교체가 PLAN_028 이면 상한 문구를 보이고 새로고침 안내는 없다', async ({ page }) => {
    await page.goto('/plans')

    const { placeId, planTitle } = await page.evaluate(async () => {
      const places = (await (await fetch('/api/bff/places?areaCode=39&size=5')).json()) as {
        dataBody: { contents: { placeId: string }[] }
      }
      const place = places.dataBody.contents[0]
      if (place === undefined) throw new Error('목 장소가 없다')

      const pets = (await (await fetch('/api/bff/members/me/pets')).json()) as {
        dataBody: { pets: { petId: string }[] }
      }
      const day = (offset: number) => {
        const now = new Date()
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
        return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
      }

      const title = `상한 확인용 일정 ${Date.now()}`
      await fetch('/api/bff/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          areaCode: '39',
          title,
          startDate: day(7),
          endDate: day(8),
          petId: pets.dataBody.pets[0]?.petId,
        }),
      })
      return { placeId: place.placeId, planTitle: title }
    })

    await page.route('**/api/bff/plans/*/days/*/items', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              dataHeader: {
                success: false,
                resultCode: 'PLAN_028',
                resultMessage: '일정에는 항목을 최대 100개까지 담을 수 있습니다.',
                fieldErrors: null,
              },
              dataBody: null,
            }),
          })
        : route.continue(),
    )

    await page.goto(`/places/${placeId}`)
    await page
      .getByRole('button', { name: messages.plan.addToPlanAction, exact: true })
      .first()
      .click()

    const sheet = page.getByRole('dialog', { name: messages.plan.addToPlanSheetTitle })
    await sheet.getByRole('button', { name: planTitle }).click()
    await sheet.getByRole('button', { name: /^1일차 / }).click()
    await sheet
      .getByRole('button', { name: messages.plan.addToPlanSubmit.replace('{day}', '1') })
      .click()

    await expect(sheet.getByText(messages.plan.saveItemLimitError)).toBeVisible()
    await expect(sheet.getByText(messages.plan.saveStaleError)).toHaveCount(0)
  })
})
