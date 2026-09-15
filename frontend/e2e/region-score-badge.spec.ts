import { expect, test } from '@playwright/test'

import { VIEWPORTS } from './helpers/layout'

/**
 * **권역 점수 배지가 한 글자 길어진 뒤의 실측** — 이슈 #638.
 *
 * 배지 텍스트가 `100` → `100점` 이 되면서 폭이 늘었는데, 권역 칸은 폭이 **고정**이다
 * (`w-44` 176 / `lg:w-46` 184). 늘어난 몫은 `ml-auto` 가 먹던 틈에서 먼저 빠지고, 그
 * 틈이 다 떨어지면 **숫자 자리(`w-20`)가 조용히 눌린다** — `w-20` 은 하한이 아니라 상한이라
 * 값 줄(`최고 31.0℃`)이 접혀 칸 높이가 배로 뛴다 (#412 가 잡아 둔 재발 경로다).
 *
 * `src/styles/overlay-and-region-cell.test.ts` 가 이 산식을 소스에서 읽어 검사하지만,
 * 글자 폭(`점` 한 글자가 몇 px 인가)은 소스에 없다 — **폰트가 정한다.** 그래서 여기서 잰다.
 *
 * **390 이 가장 빡빡한 폭이다** (`VIEWPORTS.mobile`). 카드 인셋을 뺀 가용폭이 좁고 칸은
 * 한 단 작은 176 이라, 여기서 안 넘치면 위 폭에서도 안 넘친다.
 */
test.describe('권역 점수 배지 — 390 실측 (#638)', () => {
  test.use({ viewport: VIEWPORTS.mobile })

  test('배지가 권역 칸의 오른쪽 경계를 넘지 않는다', async ({ page }) => {
    await page.goto('/')

    const section = page.getByRole('region', { name: '오늘 나가기 좋은 권역' })
    const cells = section.getByRole('listitem')
    await expect(cells.first()).toBeVisible()

    const overflow = await cells.evaluateAll((items) =>
      items.flatMap((item) => {
        const badge = item.querySelector('span[class*="rounded-sm"]')
        if (badge === null) return []

        const cell = item.getBoundingClientRect()
        const box = badge.getBoundingClientRect()

        // 소수점 반올림 오차 한 픽셀은 넘침이 아니다
        return box.right - cell.right > 1
          ? [`${item.textContent}: ${box.right} > ${cell.right}`]
          : []
      }),
    )

    expect(overflow).toEqual([])
  })

  /*
    **넘치지 않는 것만으로는 부족하다.** flex 가 숫자 자리를 눌러서 안 넘치게 만들 수 있는데,
    그렇게 눌리면 값 줄이 접혀 칸 높이가 배로 뛴다 — 넘침이 아니라 **접힘**으로 나타난다.
    값 줄 세 개(`최고` · `최저` · `강수`)가 각각 한 줄인지로 잡는다.
  */
  test('숫자 자리가 눌려 값 줄이 접히지 않는다', async ({ page }) => {
    await page.goto('/')

    const section = page.getByRole('region', { name: '오늘 나가기 좋은 권역' })
    await expect(section.getByRole('listitem').first()).toBeVisible()

    const wrapped = await section.getByRole('listitem').evaluateAll((items) =>
      items.flatMap((item) => {
        const numbers = item.querySelector('span[class*="flex-col"][class*="items-start"]')
        if (numbers === null) return []

        return [...numbers.children].flatMap((line) => {
          const height = line.getBoundingClientRect().height
          // `--text-caption--line-height` 가 18px 이다 — 두 줄이면 36 이 된다
          return height > 27 ? [`${line.textContent}: ${height}px`] : []
        })
      }),
    )

    expect(wrapped).toEqual([])
  })
})
