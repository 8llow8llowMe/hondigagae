import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { VIEWPORTS } from './helpers/layout'

/**
 * 돌아가기가 제목 줄로 들어간다 — 이슈 #539.
 *
 * **유닛이 못 보는 것을 본다.** `back-link.test.ts` 는 클래스가 붙었는지까지만 알고,
 * `md:basis-full` 이 실제로 줄바꿈을 만드는지는 모른다 — `flex-wrap` 부모가 없으면
 * 그 클래스는 아무 일도 하지 않는다. 여기서는 **실제로 같은 줄에 섰는지**를 잰다.
 *
 * 스크린샷이 아니라 계산된 값을 단언한다 (#467) — OS·폰트에 안 흔들려 CI 기준선 관리가
 * 필요 없다.
 */

/** 목 데이터의 일정 — `surface.spec.ts` 가 쓰는 것과 같은 id */
const ADD_PLACE = '/plans/223456789012000001/days/1/add?view=list'

/**
 * 두 요소가 **같은 줄**에 섰는지. 세로 구간이 겹치면 같은 줄이다.
 *
 * `top` 이 같은지 보지 않는 이유: 뒤로가기는 44px 링크고 `h1` 은 글줄이라 높이가 달라
 * 위 모서리가 애초에 안 맞는다. 잡으려는 것은 "나란히 섰는가" 이지 "위가 같은가" 가 아니다.
 */
async function onSameRow(page: Page, a: string, b: string): Promise<boolean> {
  const boxA = await page.locator(a).first().boundingBox()
  const boxB = await page.locator(b).first().boundingBox()

  if (boxA === null || boxB === null) return false
  return boxA.y < boxB.y + boxB.height && boxB.y < boxA.y + boxA.height
}

test.describe('돌아가기 — 제목 줄 (#539)', () => {
  const BACK = `a:has-text("${messages.plan.addPlaceBack}")`
  const TITLE = 'h1'

  test('모바일에서 제목과 같은 줄에 선다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(ADD_PLACE)
    await page.locator(TITLE).first().waitFor()

    expect(await onSameRow(page, BACK, TITLE)).toBe(true)
  })

  test('모바일에서 제목 왼쪽이다 — 오른쪽에 서면 돌아가기로 안 읽힌다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(ADD_PLACE)
    await page.locator(TITLE).first().waitFor()

    const back = await page.locator(BACK).first().boundingBox()
    const title = await page.locator(TITLE).first().boundingBox()

    expect(back).not.toBeNull()
    expect(title).not.toBeNull()
    expect(back!.x).toBeLessThan(title!.x)
  })

  /*
    **아이콘만 남아도 손가락이 닿아야 한다** (DESIGN.md §7). 라벨이 `sr-only` 로 빠지면서
    가로가 아이콘 폭으로 쪼그라들 수 있는 자리다 — `min-w-11` 이 실제로 44px 를 만드는지
    유닛은 알지 못한다.
  */
  test('모바일 터치 영역이 44x44 이상이다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(ADD_PLACE)
    await page.locator(TITLE).first().waitFor()

    const box = await page.locator(BACK).first().boundingBox()

    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  /*
    **데스크톱은 지금 그대로다.** #539 가 바꾸기로 한 것은 모바일뿐이고, 이 단언이 없으면
    `md:basis-full` 을 잃어도(= 데스크톱까지 제목 옆으로 붙어도) 아무도 모른다.
  */
  for (const size of ['tablet', 'desktop'] as const) {
    test(`${size} 에서는 제목 위에 선다 — 텍스트 링크 그대로`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[size])
      await page.goto(ADD_PLACE)
      await page.locator(TITLE).first().waitFor()

      expect(await onSameRow(page, BACK, TITLE)).toBe(false)

      const back = await page.locator(BACK).first().boundingBox()
      const title = await page.locator(TITLE).first().boundingBox()
      expect(back!.y).toBeLessThan(title!.y)
    })
  }

  /*
    **이름은 브레이크포인트를 타지 않는다.** 모바일에서 라벨이 시각적으로만 빠지므로
    접근성 이름은 세 폭에서 모두 같아야 한다 — `aria-label` 을 따로 두지 않은 이유가
    여기서 지켜진다.
  */
  for (const size of ['mobile', 'tablet', 'desktop'] as const) {
    test(`${size} 에서 접근성 이름이 같다`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[size])
      await page.goto(ADD_PLACE)
      await page.locator(TITLE).first().waitFor()

      await expect(
        page.getByRole('link', { name: messages.plan.addPlaceBack, exact: true }),
      ).toBeVisible()
    })
  }
})
