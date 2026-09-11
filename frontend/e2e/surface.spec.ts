import { expect, test } from '@playwright/test'

import {
  hasHorizontalOverflow,
  headingOutline,
  leftEdge,
  surfaceStyle,
  token,
  VIEWPORTS,
} from './helpers/layout'

/**
 * **3층 표면(`DESIGN.md §0`) 불변식.** 로드맵 #455 가 화면을 하나씩 옮기는 동안 손으로
 * 재던 값들을 코드로 잠근다 (이슈 #467).
 *
 * 화면별 디자인이 아니라 **층 규약**만 본다 — 바닥은 `--bg-sunken`, 카드는 흰 면에
 * 그림자 없이 radius 12(모바일은 전폭·상하 테두리만), L0 위 블록은 카드 안 글줄과 같은
 * 세로선. 화면 고유의 배치는 각 화면 렌더 테스트(vitest)와 `fe-design-reviewer` 의 몫이다.
 */
/**
 * **`/places` 는 `?view=list` 로 연다.** 기본값이 지도(`PLACES_DEFAULT_VIEW`)인데
 * **지도는 전폭 미디어라 카드가 아니다** — §0 판정에서 명시적으로 빠지는 예외다.
 * 기본 URL 을 그대로 쓰면 이 스펙이 "L0 바닥이 없다" 로 지도 갈래를 오진한다.
 */
const SCREENS = ['/mypage', '/pets', '/favorites', '/places?view=list'] as const

test.describe('3층 표면', () => {
  for (const path of SCREENS) {
    test.describe(path, () => {
      test('바닥은 --bg-sunken 이고 전폭이다', async ({ page }) => {
        await page.goto(path)
        const main = page.getByRole('main')

        const [bg, sunken] = await Promise.all([
          main.evaluate((el) => getComputedStyle(el).backgroundColor),
          token(page, '--bg-sunken'),
        ])

        // 토큰 문자열과 계산된 rgb 를 직접 비교할 수 없다 — 같은 값을 다시 칠해 비교한다
        const sunkenRgb = await page.evaluate((value) => {
          const probe = document.createElement('div')
          probe.style.backgroundColor = value
          document.body.append(probe)
          const computed = getComputedStyle(probe).backgroundColor
          probe.remove()
          return computed
        }, sunken)

        expect(bg).toBe(sunkenRgb)
      })

      test('카드는 흰 면 + 그림자 없음이고, radius 는 md 에서만 붙는다', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile)
        await page.goto(path)

        const card = page.getByRole('main').locator('section').first()
        const mobile = await surfaceStyle(card)

        // 모바일(<768)은 전폭이다 — radius 와 좌우 테두리를 걷고 상하만 남긴다 (§0)
        expect(mobile.boxShadow).toBe('none')
        expect(mobile.borderTopLeftRadius).toBe('0px')
        expect(mobile.borderLeftWidth).toBe('0px')
        expect(mobile.borderTopWidth).toBe('1px')

        await page.setViewportSize(VIEWPORTS.desktop)
        const desktop = await surfaceStyle(card)

        expect(desktop.boxShadow).toBe('none')
        // radius 12 이지 16 이 아니다 — 16 은 오버레이 몫이다 (§0)
        expect(desktop.borderTopLeftRadius).toBe('12px')
        expect(desktop.borderLeftWidth).toBe('1px')
        expect(desktop.backgroundColor).toBe(mobile.backgroundColor)
      })

      for (const [name, size] of Object.entries(VIEWPORTS)) {
        test(`${name} 에서 가로로 넘치지 않는다`, async ({ page }) => {
          await page.setViewportSize(size)
          await page.goto(path)

          expect(await hasHorizontalOverflow(page)).toBe(false)
        })
      }

      /**
       * **`h1` 은 하나, 내려갈 때는 한 단씩.** 3a 가 목록 항목을 `h3` 로 내린(#464 · #466)
       * 축이 유지되는지 본다 — 카드가 `h2` 인데 항목이 `h2` 면 구조가 평평해진다.
       *
       * **"첫 제목이 `h1`" 은 요구하지 않는다.** `/places?view=list` 는 필터 레일이
       * `main` 안에서 목록보다 앞에 있어 `h2 필터` 가 페이지 `h1` 보다 먼저 나온다
       * (#439 의 레일 레이아웃). 제목으로 탐색할 때 걸리는 순서지만 이 스펙이 정할
       * 문제가 아니라, 여기서는 실제로 성립하는 불변식만 잠근다.
       */
      test('h1 이 하나이고 제목 레벨이 한 단씩만 내려간다', async ({ page }) => {
        await page.goto(path)
        // 카드가 서기 전에 재면 Suspense 전환 중의 두 트리를 함께 본다
        await expect(page.getByRole('main').locator('section').first()).toBeVisible()

        const outline = await headingOutline(page)

        expect(outline.filter((entry) => entry.startsWith('H1:'))).toHaveLength(1)

        let previous = Number(outline[0]?.[1] ?? 1)
        for (const entry of outline) {
          const level = Number(entry[1])
          // 내려갈 때 한 단씩만 — 올라가는 것(h3 → h2)은 다음 묶음이라 제한하지 않는다
          expect(level).toBeLessThanOrEqual(previous + 1)
          previous = level
        }
      })
    })
  }
})

/**
 * **L0 위 블록은 카드 안 글줄과 같은 세로선에 선다** (`plan-add-place-header`, #451).
 *
 * `md` 이상에서 카드 테두리 1px 만큼 남는 어긋남은 의도된 것이다 — `Surface` 가
 * `md:border` 를 써서 padding box 가 border box 보다 1px 안쪽인데, L0 블록에는 상쇄할
 * 테두리가 없다. 모바일(`border-y`)은 정확히 맞는다. **그 1px 이 20px 로 벌어지는 것을
 * 잡는 것이 이 테스트의 목적이다** (인셋을 `card` 가 아니라 `main` 으로 주면 그렇게 된다).
 */
test.describe('L0 위 블록의 세로 기준선 — /mypage', () => {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    test(`${name}`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto('/mypage')

      const cardText = page.getByRole('heading', { name: '계정', exact: true })
      const l0Action = page.getByRole('button', { name: '로그아웃', exact: true })

      await expect(cardText).toBeVisible()
      await expect(l0Action).toBeVisible()

      const drift = (await leftEdge(cardText)) - (await leftEdge(l0Action))

      expect(drift).toBeLessThanOrEqual(size.width < 768 ? 0 : 1)
      expect(drift).toBeGreaterThanOrEqual(0)
    })
  }
})
