import { expect, test } from '@playwright/test'

/**
 * **모달 입력 중 초점이 빠지지 않는가** — 이슈 [#1026](https://github.com/8llow8llowMe/hondigagae/issues/1026).
 *
 * ### 무엇이 깨졌나
 *
 * `이동·휴식 추가` 모달에 한글을 치면 `ㅊㅏㄹㅗ` · `ㅊ차찰차로차로` 처럼 자모가 쪼개져 쌓였다.
 * `useOverlay` 의 effect 가 `onClose` 를 의존성으로 두는데, 모달 뷰가 렌더마다 새 `onClose` 를
 * 넘겨 **키 하나마다 effect 가 다시 돌았다** — cleanup 이 초점을 트리거 버튼으로 돌려놓고
 * setup 이 다시 입력으로 넣는다. 그 초점 이동이 IME 조합을 매번 확정시킨다.
 *
 * ### 왜 e2e 인가
 *
 * vitest 는 `environment: 'node'` 라 초점도 IME 도 없다. 인라인 콜백 하나로 조용히 돌아오는
 * 결함이라 **실제 브라우저의 초점 이벤트**를 세야 잡힌다. IME 조합은 CDP 로 흉내 낸다 —
 * 조합 중에 초점이 빠지면 조합 문자열이 매번 확정돼 값에 누적된다.
 */
test.describe('모달 입력 초점 (#1026)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plans')
    const href = await page.locator('a[href^="/plans/"]').first().getAttribute('href')
    expect(href).not.toBeNull()
    await page.goto(href ?? '/plans')

    await page.getByRole('button', { name: '이동·휴식 추가' }).first().click()
    await expect(page.getByRole('dialog').getByRole('textbox')).toBeFocused()
  })

  test('글자를 치는 동안 초점이 입력을 떠나지 않는다', async ({ page }) => {
    const input = page.getByRole('dialog').getByRole('textbox')

    await page.evaluate(() => {
      const events: string[] = []
      ;(window as unknown as { __focusEvents: string[] }).__focusEvents = events
      document.addEventListener(
        'focusout',
        (event) => events.push(`out:${(event.target as HTMLElement).tagName}`),
        true,
      )
    })

    await input.pressSequentially('abc', { delay: 50 })

    const events = await page.evaluate(
      () => (window as unknown as { __focusEvents: string[] }).__focusEvents,
    )
    expect(events).toEqual([])
    await expect(input).toHaveValue('abc')
  })

  test('한글 조합이 쪼개지지 않는다', async ({ page, context }) => {
    const input = page.getByRole('dialog').getByRole('textbox')
    const cdp = await context.newCDPSession(page)

    for (const text of ['ㅊ', '차', '찰', '차로']) {
      await cdp.send('Input.imeSetComposition', {
        text,
        selectionStart: text.length,
        selectionEnd: text.length,
      })
    }
    await cdp.send('Input.insertText', { text: '차로' })

    await expect(input).toHaveValue('차로')
  })
})
