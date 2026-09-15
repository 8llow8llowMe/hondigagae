import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { CONTENT_MAX, hasHorizontalOverflow, VIEWPORTS } from './helpers/layout'

/**
 * 기간 혼잡도 30일 레일이 **가로로 새지 않는지** 잰다 (#603).
 *
 * ### 왜 vitest 로는 못 잡나
 *
 * 이 저장소의 단위 테스트는 `environment: 'node'` 라 마크업 **문자열**만 본다
 * (`docs/testing-guide.md §1`). `place-congestion-panel.test.ts` 가 잠그는 것은
 * "`scroll-rail` 이라는 글자가 붙어 있다" 까지다 — 그 클래스가 실제로 넘침을 막는지,
 * 조상 어딘가가 다시 새게 만드는지는 **레이아웃이 있어야만** 알 수 있다.
 *
 * ### 무엇이 샜나
 *
 * 날짜 칸마다 붙는 `sr-only` 라벨(`9월 1일 화요일 혼잡`)은 `position: absolute` 다.
 * 바깥 스크롤러가 `position: static` 이면 그 30개의 컨테이닝 블록이 스크롤러가 아니라
 * **더 바깥의 positioned 조상**이 되어, 스크롤러가 자기 내용을 클립하고 있어도 저것들은
 * 클립되지 않고 정적 위치가 조상의 `scrollWidth` 로 샌다.
 *
 * 수정 전 실측(`/places/126434` 30일):
 *
 * | 폭 | 증상 |
 * |---|---|
 * | 1440 | 좌측 판정 레일이 가로로 770px 스크롤 — `scrollWidth` 1164 / `clientWidth` 394 |
 * | 390 | 페이지가 통째로 넘침 — `documentElement.scrollWidth` 390 → 1135 |
 *
 * **카드를 우측 본문 열로 옮겨도 이 성질은 그대로다** — 그 열은 sticky 도 스크롤 컨테이너도
 * 아니라 `sr-only` 가 `body` 까지 새고, 넘치는 쪽이 레일에서 **페이지**로 바뀔 뿐이다.
 * 그래서 이 스펙은 배치와 무관하게 `documentElement` 를 잰다 — DESIGN.md §7 이 "375 에서
 * 가로 스크롤이 생기면 버그다" 로 못박은 바로 그 값이다.
 */

/** 목 저장소의 첫 장소. `surface.spec.ts` 도 이 id 로 상세를 연다 */
const PLACE = '/places/212481712381923329'

/** `CONGESTION_DAYS.month` — 혼잡도 예측이 답할 수 있는 끝이고, **첫 화면의 기본값**이다 */
const MONTH_DAYS = 30

/** `CONGESTION_DAYS.week` — 좁히는 쪽 선택지 */
const WEEK_DAYS = 7

/**
 * **`--content-max` 폭을 따로 잰다.**
 *
 * 공용 `VIEWPORTS.desktop` 은 1920 인데, 거기서는 이 결함이 **화면 밖으로 나가지 않는다** —
 * `.rail-layout` 이 1440 으로 캡을 걸어 본문 열이 x=640 에서 시작하고, 30칸은 1774 에서 끝나
 * 1920 안에 들어간다. 수정을 통째로 되돌리고 돌려도 1920 은 통과했다(실측).
 *
 * 1440 은 본문 열이 x=400 에서 시작해 화면 밖으로 나간다 — **콘텐츠 캡과 같은 폭이 가장
 * 빡빡한 데스크톱**이고, 이 저장소의 아트보드 기준 폭(03)이기도 하다. 넓은 화면만 재면
 * 데스크톱을 쟀다고 착각하면서 정작 기준 폭을 놓친다.
 */
const CONTENT_MAX_VIEWPORT = { width: CONTENT_MAX, height: 900 } as const

const WIDTHS = { ...VIEWPORTS, contentMax: CONTENT_MAX_VIEWPORT } as const

/**
 * **칸이 다 설 때까지 기다린다.**
 *
 * 30일이 기본이 되면서 클릭이 필요 없어졌지만, 기다리는 이유는 그대로다 — 조회 중에는
 * 스켈레톤이 서고 그 순간에 폭을 재면 넘치기 전 상태를 재고 지나간다.
 */
async function monthRail(page: Page) {
  const card = page.getByRole('region', { name: messages.place.detailCongestionTitle })

  await expect(card.getByRole('listitem')).toHaveCount(MONTH_DAYS)

  return card
}

test.describe('기간 혼잡도 — 30일 레일 (#603)', () => {
  for (const [name, viewport] of Object.entries(WIDTHS)) {
    test(`${name} — 기본값인 30일에서 페이지가 가로로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(PLACE)

      const card = await monthRail(page)

      await expect.poll(() => hasHorizontalOverflow(page)).toBe(false)

      /*
        **7일로 좁혔다 되돌아와도 그대로다.** 레일을 만드는 분기가 `days` 에 달려 있어,
        토글이 스크롤러·페이드·화살표를 떼었다 붙인다 — 그 왕복에서 넘침이 되살아나는지는
        첫 렌더만 재서는 알 수 없다.
      */
      await card.getByRole('button', { name: messages.place.detailCongestionCollapse }).click()
      await expect(card.getByRole('listitem')).toHaveCount(WEEK_DAYS)
      await expect.poll(() => hasHorizontalOverflow(page)).toBe(false)

      await card.getByRole('button', { name: messages.place.detailCongestionExpand }).click()
      await expect(card.getByRole('listitem')).toHaveCount(MONTH_DAYS)
      await expect.poll(() => hasHorizontalOverflow(page)).toBe(false)
    })
  }

  /**
   * **넘침을 삼킨 것이 아니라 스크롤러 안에 가둔 것인지** 확인한다.
   *
   * 페이지가 안 넘치는 것만으로는 부족하다. 넘침이 중간 조상에 고여도 `documentElement` 는
   * 멀쩡할 수 있다 — 수정 전 1440 에서 좌측 판정 레일이 정확히 그랬다(`scrollWidth` 1164 /
   * `clientWidth` 394). 페이지는 안 넘쳤지만 레일이 대신 가로로 굴렀다.
   *
   * 그래서 **카드의 조상을 끝까지 훑어** 가로로 구를 수 있는 것이 하나도 없는지 본다.
   *
   * **클래스 이름으로 찾지 않는다.** `.scroll-rail` 이 붙었는지는 단위 테스트가 이미
   * 잠갔다. 여기서 이름을 다시 세면 같은 것을 두 번 재면서 **정작 넘침은 안 재는** 테스트가
   * 된다 — 실제로 첫 판이 그랬다. 계산된 `overflow-x` 로 찾아, 클래스를 어떻게 바꾸든
   * "넘침이 스크롤러 안에 있다" 만 남게 한다.
   */
  test('1440 — 카드도 그 조상도 가로로 구르지 않는다', async ({ page }) => {
    await page.setViewportSize(CONTENT_MAX_VIEWPORT)
    await page.goto(PLACE)

    const card = await monthRail(page)

    const measured = await card.evaluate((section) => {
      const scroller = [...section.querySelectorAll('*')].find((el) => {
        const overflowX = getComputedStyle(el).overflowX
        return overflowX === 'auto' || overflowX === 'scroll'
      })

      /*
        부분 픽셀 반올림으로 1px 이 남는 일이 있어 여유를 둔다. 막으려는 것은 30칸이
        통째로 새는 것(수백 px)이라 이 여유가 증상을 가리지 않는다.
      */
      const leaking: string[] = []
      for (let el: Element | null = section; el !== null; el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 1) {
          leaking.push(`${el.tagName}.${el.className.toString().slice(0, 40)}`)
        }
      }

      return {
        leaking,
        scrollerScrollWidth: scroller?.scrollWidth ?? 0,
        scrollerClientWidth: scroller?.clientWidth ?? 0,
      }
    })

    // 카드부터 `html` 까지 어느 것도 가로로 구를 여지가 없다
    expect(measured.leaking).toEqual([])
    // 30칸은 실제로 넘치고 그 넘침은 스크롤러가 가진다 — 안 넘치면 이 스펙이 무의미해진다
    expect(measured.scrollerScrollWidth).toBeGreaterThan(measured.scrollerClientWidth)
  })
})
