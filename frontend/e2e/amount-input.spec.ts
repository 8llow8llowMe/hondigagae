import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * **예산 입력칸이 쉼표를 붙이고 커서를 제자리에 두는가** — 이슈 #986.
 *
 * ### 왜 e2e 인가
 *
 * 커서를 **몇 번째 칸에 둘지**는 `lib/form/grouped-digits.test.ts` 가 순수 함수로 잠근다. 여기서
 * 보는 것은 그 값이 **실제로 커서가 되는가** 다 — React 가 값을 다시 쓰는 순간 커서가 끝으로
 * 튀는 것이 이 종류 입력의 전형적인 회귀이고, node 환경에는 입력 이벤트도 커서도 없다
 * (`docs/testing-guide.md` §1). 백스페이스가 쉼표를 만났을 때의 `inputType` 도 브라우저만 준다.
 *
 * ### 왜 세 자리를 다 보나
 *
 * `AmountInput` 의 계약을 **모든 사용처에서** 잰다 (`testing-guide.md` §12 의 "몇 곳에서 같은
 * 것을 보는가"). 흐름 전체는 만들기 폼에서 보고, 수정 모달은 **전송 값이 숫자인지**까지,
 * AI 폼은 쉼표가 붙는지만 본다.
 */

/** 입력란의 커서 위치. 선택 영역이 없을 때의 `selectionStart` 다 */
function caretOf(input: Locator): Promise<number | null> {
  return input.evaluate((node) => (node as HTMLInputElement).selectionStart)
}

/** 커서를 맨 앞에서 `offset` 칸 오른쪽에 둔다 */
async function placeCaret(page: Page, input: Locator, offset: number): Promise<void> {
  await input.focus()
  await page.keyboard.press('Home')
  for (let step = 0; step < offset; step += 1) await page.keyboard.press('ArrowRight')
}

test.describe('예산 입력 천 단위 쉼표 (#986)', () => {
  test('만들기 폼 — 입력 · 끼워 치기 · 쉼표 지우기 · 글자 · 전부 지우기', async ({ page }) => {
    await page.goto('/plans/new')
    const budget = page.locator('#budget')

    // 입력 — 치는 동안 쉼표가 붙고 커서는 끝이다
    await budget.pressSequentially('300000')
    await expect(budget).toHaveValue('300,000')
    expect(await caretOf(budget)).toBe(7)
    await expect(budget).toHaveAttribute('inputmode', 'numeric')

    // 가운데에 끼워 치기 — 3|00,000 에 1 → 3,1|00,000 (방금 친 1 바로 뒤)
    await placeCaret(page, budget, 1)
    await page.keyboard.type('1')
    await expect(budget).toHaveValue('3,100,000')
    expect(await caretOf(budget)).toBe(3)

    // 쉼표 바로 뒤 백스페이스 — 쉼표가 아니라 그 앞 숫자가 지워진다
    await budget.fill('')
    await budget.pressSequentially('300000')
    await placeCaret(page, budget, 4) // 300,|000
    await page.keyboard.press('Backspace')
    await expect(budget).toHaveValue('30,000')
    expect(await caretOf(budget)).toBe(2)

    // 숫자가 아닌 글자 — 버려지고 커서는 제자리다
    await placeCaret(page, budget, 1)
    await page.keyboard.type('a')
    await expect(budget).toHaveValue('30,000')
    expect(await caretOf(budget)).toBe(1)

    // 전부 지우기 — 빈 값이다 (0 이 아니다)
    await budget.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await expect(budget).toHaveValue('')
  })

  /*
    **첫 자리를 지워도 남은 자릿수가 살아 있다** (#986 리뷰 HIGH). 예전에는 지우기로 생긴 앞자리
    0 까지 떼어 `3|00,000` → 3 지우기 → `0` 이 됐고, 5 를 치면 `50` 이었다.
  */
  test('만들기 폼 — 첫 자리를 지우고 다시 치면 500,000 이다', async ({ page }) => {
    await page.goto('/plans/new')
    const budget = page.locator('#budget')

    // 3|00,000 → 백스페이스 → 5
    await budget.pressSequentially('300000')
    await placeCaret(page, budget, 1)
    await page.keyboard.press('Backspace')
    await expect(budget).toHaveValue('00,000')
    expect(await caretOf(budget)).toBe(0)
    await page.keyboard.type('5')
    await expect(budget).toHaveValue('500,000')
    expect(await caretOf(budget)).toBe(1)

    // 3,|000 쉼표 뒤 백스페이스 → 3 이 지워진다 → 7
    await budget.fill('')
    await budget.pressSequentially('3000')
    await placeCaret(page, budget, 2)
    await page.keyboard.press('Backspace')
    await expect(budget).toHaveValue('000')
    await page.keyboard.type('7')
    await expect(budget).toHaveValue('7,000')

    // |300,000 에서 Delete → 5
    await budget.fill('')
    await budget.pressSequentially('300000')
    await placeCaret(page, budget, 0)
    await page.keyboard.press('Delete')
    await expect(budget).toHaveValue('00,000')
    await page.keyboard.type('5')
    await expect(budget).toHaveValue('500,000')
  })

  test('만들기 폼 — 지우고 남은 앞자리 0 은 포커스를 떠날 때 정리된다', async ({ page }) => {
    await page.goto('/plans/new')
    const budget = page.locator('#budget')

    await budget.pressSequentially('300000')
    await placeCaret(page, budget, 1)
    await page.keyboard.press('Backspace')
    await expect(budget).toHaveValue('00,000')

    await budget.blur()
    await expect(budget).toHaveValue('0')
  })

  test('만들기 폼 — 직접 친 소수점은 무시한다', async ({ page }) => {
    await page.goto('/plans/new')
    const budget = page.locator('#budget')

    await budget.pressSequentially('300000')
    await placeCaret(page, budget, 2)
    await page.keyboard.type('.')
    await expect(budget).toHaveValue('300,000')
    expect(await caretOf(budget)).toBe(2)
  })

  test('만들기 폼 — 붙여넣기는 숫자만 남긴다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/plans/new')
    const budget = page.locator('#budget')

    // 소수부는 버린다 — `300,000.00` 이 `30,000,000` 이 되면 값이 조용히 100배다 (#986 리뷰)
    for (const pasted of ['300,000원', '300000', '300,000.00']) {
      await budget.fill('')
      await page.evaluate((text) => navigator.clipboard.writeText(text), pasted)
      await budget.focus()
      await page.keyboard.press('ControlOrMeta+v')
      await expect(budget).toHaveValue('300,000')
      expect(await caretOf(budget)).toBe(7)
    }
  })

  test('수정 모달 — 쉼표로 보이고 전송 값은 숫자다', async ({ page }) => {
    await page.goto('/plans')
    const planId = await page.evaluate(async () => {
      const pets = (await (await fetch('/api/bff/members/me/pets')).json()) as {
        dataBody: { pets: { petId: string }[] }
      }
      const response = await fetch('/api/bff/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          areaCode: '39',
          title: '예산 쉼표 확인용 일정',
          startDate: '2030-01-10',
          endDate: '2030-01-11',
          petId: pets.dataBody.pets[0]?.petId,
          budget: 450000,
          items: [],
        }),
      })
      return ((await response.json()) as { dataBody: { planId: string } }).dataBody.planId
    })

    await page.goto(`/plans/${planId}`)
    await page.getByRole('button', { name: '일정 관리' }).click()
    await page.getByRole('menuitem', { name: /^이름·기간·예산/ }).click()

    const budget = page.locator('#plan-edit-budget')
    // 저장된 값이 처음부터 쉼표로 보인다
    await expect(budget).toHaveValue('450,000')

    await budget.fill('')
    await budget.pressSequentially('1200000')
    await expect(budget).toHaveValue('1,200,000')

    const request = page.waitForRequest(
      (req) => req.method() === 'PUT' && req.url().endsWith(`/api/bff/plans/${planId}`),
    )
    await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
    const body = (await request).postDataJSON() as { budget: unknown }
    expect(body.budget).toBe(1200000)
  })

  test('AI 일정 폼 — 같은 입력칸이다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/ai-plans/new')
    await page.getByRole('button', { name: /더 자세히 정할게요/ }).click()

    const budget = page.locator('#budgetManwon')
    await budget.pressSequentially('1500')
    await expect(budget).toHaveValue('1,500')
    expect(await caretOf(budget)).toBe(5)

    // 만원 단위에서 `1.5` 가 `15` 가 되면 10배다 — 소수부를 버려 `1` 이다 (#986 리뷰)
    await budget.fill('')
    await page.evaluate(() => navigator.clipboard.writeText('1.5'))
    await budget.focus()
    await page.keyboard.press('ControlOrMeta+v')
    await expect(budget).toHaveValue('1')
  })
})
