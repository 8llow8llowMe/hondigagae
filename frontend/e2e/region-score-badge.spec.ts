import { expect, type Page, test } from '@playwright/test'

import { VIEWPORTS } from './helpers/layout'

/**
 * **권역 칸의 줄이 접히지 않는지 실측한다** — 이슈 #638 · #1065 · #1068.
 *
 * 권역 칸은 폭이 **고정**이다 (`w-44` 176 / `lg:w-46` 184). 칸 안의 글자가 그 폭을 넘으면
 * 넘치거나 **접혀** 칸 높이가 뛴다. `src/styles/overlay-and-region-cell.test.ts` 가 이 산식을
 * 소스에서 읽어 검사하지만, 글자 폭은 소스에 없다 — **폰트가 정한다.** 그래서 여기서 잰다.
 *
 * **#638 · #1065 에서는 배지가 넓어질 때마다 이 검사가 실제로 잡았다** — 그때는 `아이콘 |
 * 숫자 | 배지` 가 가로로 폭을 나눠 가져 숫자 자리가 눌렸다. #1068 에서 칸이 세로 줄 넷
 * (`이름 [추천] · 점수 · 막대 · 날씨`)이 되면서 경쟁은 없어졌지만, 줄이 칸 안에 드는지는
 * 여전히 폰트가 정하므로 검사를 남기고 **줄 수를 글자 노드마다** 센다.
 *
 * **390 이 가장 빡빡한 폭이다** (`VIEWPORTS.mobile`). 카드 인셋을 뺀 가용폭이 좁고 칸은
 * 한 단 작은 176 이라, 여기서 안 넘치면 위 폭에서도 안 넘친다. 768 은 같은 176 칸을 다른
 * 레이아웃(한 열 → 두 열 직전)에서 본다.
 */

/** 칸마다 보이는 글자 노드의 줄 수와 오른쪽 끝을 잰다 — `sr-only` 는 뺀다 */
async function measureCells(page: Page) {
  const section = page.getByRole('region', { name: '오늘 나가기 좋은 권역' })
  const cells = section.getByRole('listitem')
  await expect(cells.first()).toBeVisible()

  return cells.evaluateAll((items) =>
    items.flatMap((item) => {
      const cell = item.getBoundingClientRect()
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT)
      const problems: string[] = []

      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? ''
        if (text === '' || node.parentElement?.closest('.sr-only')) continue

        const range = document.createRange()
        range.selectNodeContents(node)
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0)
        // 한 줄이면 조각이 여럿이어도 top 이 같다 — 반올림으로 소수점 차를 흡수한다
        const lines = new Set(rects.map((rect) => Math.round(rect.top))).size
        const right = Math.max(...rects.map((rect) => rect.right))

        if (lines > 1) problems.push(`${text}: ${lines}줄`)
        // 소수점 반올림 오차 한 픽셀은 넘침이 아니다
        if (right - cell.right > 1) problems.push(`${text}: ${right} > ${cell.right}`)
      }

      return problems
    }),
  )
}

for (const [label, viewport] of [
  ['390', VIEWPORTS.mobile],
  ['768', VIEWPORTS.tablet],
] as const) {
  test.describe(`권역 칸 — ${label} 실측 (#638 · #1068)`, () => {
    test.use({ viewport })

    test('칸 안의 글자가 접히거나 칸 밖으로 넘치지 않는다', async ({ page }) => {
      await page.goto('/')

      expect(await measureCells(page)).toEqual([])
    })
  })
}
