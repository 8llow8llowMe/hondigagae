import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { VIEWPORTS } from './helpers/layout'

/**
 * 배타 묶음의 키보드 규약 — 이슈 [#825](https://github.com/8llow8llowMe/hondigagae/issues/825).
 *
 * **유닛이 못 보는 결함이다.** 이 저장소는 jsdom 없이 `renderToStaticMarkup` 문자열로
 * 단언하므로 `tabindex` 값은 볼 수 있어도 **포커스가 실제로 옮겨 갔는지는 볼 수 없다.**
 * `tabindex="-1"` 만 달고 `onKeyDown` 을 빠뜨려도 유닛은 전부 초록이고, 그때 묶음은
 * **아무 키로도 고를 수 없는 컨트롤**이 된다 — 지금보다 나쁘다.
 *
 * 잠그는 것은 화면 배치가 아니라 **컨트롤의 계약**이다 (`testing-guide.md` §12):
 * ① 묶음 전체가 탭 스톱 하나다 ② 화살표가 포커스를 옮기고 ③ 옮기면서 선택이 바뀐다.
 */

const LIST = '/olle'
const GROUP = messages.walkCourse.sortGroupLabel

async function openList(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORTS.desktop)
  await page.goto(LIST)
  await page.getByRole('radiogroup', { name: GROUP }).waitFor()
}

/** 지금 포커스를 가진 칸의 글자. 묶음 밖이면 `null` */
function focusedOption(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.activeElement
    if (active === null || active.getAttribute('role') !== 'radio') return null
    return (active.textContent ?? '').trim()
  })
}

test.describe('배타 묶음 키보드 (#825)', () => {
  /**
   * **묶음 하나가 탭 스톱 하나다.** 전에는 칸이 전부 탭 스톱이라 정렬 하나를 지나가려면
   * Tab 을 칸 수만큼 눌러야 했다.
   */
  test('묶음 안에서 탭 스톱이 하나다', async ({ page }) => {
    await openList(page)
    const group = page.getByRole('radiogroup', { name: GROUP })

    const tabbable = await group.evaluate(
      (node) =>
        [...node.querySelectorAll('[role="radio"]')].filter(
          (radio) => radio.getAttribute('tabindex') === '0',
        ).length,
    )
    const options = await group.getByRole('radio').count()

    expect(options).toBeGreaterThan(1)
    expect(tabbable).toBe(1)
  })

  test('화살표가 포커스를 옮기고 선택도 함께 바뀐다', async ({ page }) => {
    await openList(page)
    const group = page.getByRole('radiogroup', { name: GROUP })
    const options = await group.getByRole('radio').allTextContents()

    await group.getByRole('radio').first().focus()
    expect(await focusedOption(page)).toBe(options[0]?.trim())

    await page.keyboard.press('ArrowRight')

    expect(await focusedOption(page)).toBe(options[1]?.trim())
    await expect(group.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true')
    await expect(group.getByRole('radio').first()).toHaveAttribute('aria-checked', 'false')
  })

  /** 마지막 칸의 화살표가 죽은 키가 되면 사용자는 그것을 "고장" 과 구분하지 못한다 */
  test('끝에서 감는다', async ({ page }) => {
    await openList(page)
    const group = page.getByRole('radiogroup', { name: GROUP })
    const options = await group.getByRole('radio').allTextContents()

    await group.getByRole('radio').last().focus()
    await page.keyboard.press('ArrowRight')

    expect(await focusedOption(page)).toBe(options[0]?.trim())
  })

  test('Home · End 가 양 끝으로 간다', async ({ page }) => {
    await openList(page)
    const group = page.getByRole('radiogroup', { name: GROUP })
    const options = await group.getByRole('radio').allTextContents()

    await group.getByRole('radio').first().focus()
    await page.keyboard.press('End')
    expect(await focusedOption(page)).toBe(options[options.length - 1]?.trim())

    await page.keyboard.press('Home')
    expect(await focusedOption(page)).toBe(options[0]?.trim())
  })

  /**
   * **Tab 은 가로채지 않는다.** 규약에 없는 키까지 먹으면 묶음을 빠져나갈 수 없다 —
   * 키보드 사용자를 가두는 쪽이 지금 결함보다 나쁘다.
   */
  test('Tab 은 묶음 밖으로 나간다', async ({ page }) => {
    await openList(page)
    const group = page.getByRole('radiogroup', { name: GROUP })

    await group.getByRole('radio').first().focus()
    await page.keyboard.press('Tab')

    expect(await focusedOption(page)).toBeNull()
  })
})
