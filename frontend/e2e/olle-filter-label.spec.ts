import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { VIEWPORTS } from './helpers/layout'

/**
 * 정렬·활동량 세그먼트의 라벨이 잘리지 않는다 — 이슈 #818.
 *
 * **유닛이 못 보는 결함이다.** 칸 안 라벨은 `truncate`(`overflow:hidden` +
 * `text-overflow:ellipsis`)로 잘리므로 **마크업 문자열에는 전문이 그대로 남는다** —
 * `renderToStaticMarkup` 단언은 전부 통과한다. 화면에만 `거리 짧…` 이 보였고, 그것을
 * 잡은 것은 브라우저 실측이었다.
 *
 * **잠그는 것은 이 화면의 배치가 아니라 세그먼트 컨트롤의 계약**이다
 * (`testing-guide.md` §12) — "칸은 제 라벨이 들어갈 만큼 넓다".
 *
 * ### 왜 재발했나
 *
 * 라벨 길이에 따라 깨지는 구조였다. `SegmentOption` 이 `flex-1` 이라 칸을 **균등
 * 분할**하는데, 데스크톱에서는 도구 줄이 세그먼트에 콘텐츠 폭만 주므로 **가장 긴
 * 라벨부터 잘린다.** [#798](https://github.com/8llow8llowMe/hondigagae/issues/798) 이
 * `짧은 순`(40px) 을 `거리 짧은 순`(67px) 으로 늘리자 54px 칸에서 넘쳤다.
 * 그래서 이 스펙은 특정 문구가 아니라 **모든 칸**을 잰다.
 */

const LIST = '/olle'

const GROUPS = [messages.walkCourse.activityGroupLabel, messages.walkCourse.sortGroupLabel] as const

type Option = { text: string; need: number; have: number; width: number; height: number }

async function openList(page: Page, size: (typeof VIEWPORTS)[keyof typeof VIEWPORTS]) {
  await page.setViewportSize(size)
  await page.goto(LIST)
  await page.getByRole('radiogroup', { name: messages.walkCourse.sortGroupLabel }).waitFor()
}

/**
 * 칸마다 **라벨이 필요로 하는 폭**과 **실제로 받은 폭**을 잰다.
 *
 * `scrollWidth > clientWidth` 가 곧 말줄임이다 — 잘린 글자는 DOM 에 남아 있으므로
 * 텍스트를 읽어서는 알 수 없다.
 */
async function options(page: Page, groupLabel: string): Promise<Option[]> {
  return page.getByRole('radiogroup', { name: groupLabel }).evaluate((group) =>
    [...group.querySelectorAll('[role="radio"]')].map((radio) => {
      const label = radio.firstElementChild ?? radio
      const box = radio.getBoundingClientRect()
      return {
        text: (radio.textContent ?? '').trim(),
        need: label.scrollWidth,
        have: label.clientWidth,
        width: box.width,
        height: box.height,
      }
    }),
  )
}

for (const size of ['tablet', 'desktop'] as const) {
  test.describe(`세그먼트 라벨 — ${size} (#818)`, () => {
    for (const group of GROUPS) {
      test(`${group} 칸의 라벨이 잘리지 않는다`, async ({ page }) => {
        await openList(page, VIEWPORTS[size])
        const found = await options(page, group)

        expect(found.length).toBeGreaterThan(1)
        for (const option of found) {
          expect(
            option.need,
            `${group} · ${option.text} 이(가) ${option.have}px 자리에 ${option.need}px 를 넣으려 한다`,
          ).toBeLessThanOrEqual(option.have)
        }
      })
    }
  })
}

test.describe('세그먼트 라벨 — 모바일은 지금 그대로다 (#818)', () => {
  /**
   * **모바일 전폭 균등 분할은 유지한다.** 좁은 폭에서는 칸을 내용 폭으로 두면 세그먼트가
   * 화면을 다 쓰지 못해 컨트롤로 읽히지 않는다. 라벨이 짧아 잘리지도 않는다 — 390 에서
   * 정렬 칸은 186px 씩이고 가장 긴 라벨이 67px 다.
   */
  test('칸이 균등하게 나뉘고 라벨도 잘리지 않는다', async ({ page }) => {
    await openList(page, VIEWPORTS.mobile)

    for (const group of GROUPS) {
      const found = await options(page, group)
      const widths = found.map((option) => option.width)
      const spread = Math.max(...widths) - Math.min(...widths)

      expect(spread, `${group} 칸 폭이 고르지 않다`).toBeLessThanOrEqual(2)
      for (const option of found) {
        expect(option.need, `${group} · ${option.text}`).toBeLessThanOrEqual(option.have)
      }
    }
  })
})

test.describe('세그먼트 터치 영역 (#818)', () => {
  /** 폭을 고치면서 높이를 잃지 않는다 — 44px 는 `DESIGN.md` §7 의 최소 터치 영역이다 */
  for (const size of ['mobile', 'tablet', 'desktop'] as const) {
    test(`${size} 에서 칸 높이가 44 이상이다`, async ({ page }) => {
      await openList(page, VIEWPORTS[size])

      for (const group of GROUPS) {
        for (const option of await options(page, group)) {
          expect(option.height, `${group} · ${option.text}`).toBeGreaterThanOrEqual(44)
        }
      }
    })
  }
})
