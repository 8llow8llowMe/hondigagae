import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test'

/**
 * **순서 편집에서 카드 전체를 잡아 끈다** — 이슈 #1029.
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 **입력 장치와 브라우저 사이의 협상**이다. 마우스는 몇 px 움직여야 끌기이고,
 * 터치는 0.3초 길게 눌러야 끌기이며 그 전에는 **화면 스크롤이 그대로 돼야 한다.** 그 스크롤을
 * 누가 가져가는지는 `touch-action` · non-passive `touchmove` · 포인터 캡처가 브라우저 안에서
 * 정한다 — node 환경 테스트(`docs/testing-guide.md` §1)는 이벤트도 스크롤도 돌리지 않는다.
 * 판정 규칙 자체는 `src/lib/plan/drag-gesture.test.ts` 가 순수 함수로 잰다.
 *
 * ### 목 일정
 *
 * `223456789012000002` 의 1일차는 장소 셋이다 (`src/lib/api/mock/store.ts`). **저장하지
 * 않는다** — 끌기는 편집 중 배열만 바꾸고, 목 저장소는 서버 프로세스 메모리라 저장하면 다른
 * 스펙이 흔들린다.
 */
const PLAN_PATH = '/plans/223456789012000002'

const SHOT_DIR = process.env.E2E_SHOT_DIR

async function openEditor(page: Page): Promise<Locator> {
  await page.goto(PLAN_PATH)
  await page.getByRole('button', { name: '순서 편집' }).first().click()

  const list = page.locator('ol').filter({ has: page.getByRole('button', { name: '위로 이동' }) })
  await expect(list.locator(':scope > li')).toHaveCount(3)
  await settle(page, list)
  return list
}

/**
 * **목록이 제자리에 멈출 때까지 기다린다.** 판정·날씨처럼 위쪽에서 늦게 오는 조각이 자리를
 * 밀면, 미리 잰 카드 좌표가 손가락 아래에서 어긋난다 — 스위트 전체를 병렬로 돌릴 때 실제로
 * 한 칸 대신 두 칸이 옮겨졌다. 끌기 판정이 아니라 **좌표가 낡은 것**이라 여기서 막는다.
 */
async function settle(page: Page, list: Locator) {
  // hydration 대기가 아니라 늦게 오는 조각의 도착 대기다 — 마운트 표식으로 옮기지 않는다 (#1103)
  await page.waitForLoadState('networkidle')
  await expect
    .poll(async () => {
      const before = await list.boundingBox()
      await page.waitForTimeout(150)
      const after = await list.boundingBox()
      return before !== null && after !== null && before.y === after.y
    })
    .toBe(true)
}

/** 카드 제목 순서. 제목 칸(`min-w-0 flex-1`)의 첫 줄 첫 글자가 제목이다 — 버튼 글자는 빼야 한다 */
async function titles(list: Locator): Promise<string[]> {
  return list
    .locator(':scope > li .min-w-0.flex-1 > div:first-child > span:first-child')
    .allTextContents()
}

/** 카드의 들린 모양 — 끄는 중에만 붙는다 */
/**
 * 들린 카드. **숫자가 아니라 로케이터로 돌려 `toHaveCount` 로 기다린다** (#1029 검토) —
 * 창 리스너 안의 `setState` 는 이벤트 우선순위상 한 틱 늦게 반영될 수 있어, 한 번 읽고
 * 판정하면 CI 가 붐빌 때 흔들린다. 0.3초 문턱 뒤의 들림은 특히 그렇다.
 */
function lifted(list: Locator): Locator {
  return list.locator(':scope > li.shadow-md')
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('카드가 화면에 없다')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function shot(page: Page, name: string) {
  if (SHOT_DIR !== undefined) await page.screenshot({ path: `${SHOT_DIR}/1029-${name}.png` })
}

test.describe('순서 편집 — 마우스로 카드를 끈다 (#1029)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('카드 가운데를 잡고 끌면 순서가 바뀐다 — 끄는 동안 카드가 들린다', async ({ page }) => {
    const list = await openEditor(page)
    const cards = list.locator(':scope > li')
    const before = await titles(list)

    const from = await center(cards.nth(0))
    const to = await center(cards.nth(1))

    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    // 문턱(5px) 아래로만 움직이면 아직 끌기가 아니다 — 클릭과 헷갈리지 않는다
    await page.mouse.move(from.x, from.y + 3)
    await expect(lifted(list)).toHaveCount(0)

    await page.mouse.move(to.x, to.y + 12, { steps: 12 })
    await expect(lifted(list)).toHaveCount(1)
    // 들린 모양 — 그림자와 살짝 확대 (움직임 줄이기 설정이 아닐 때)
    await expect(list.locator(':scope > li.shadow-md')).not.toHaveCSS('scale', 'none')
    await shot(page, 'mouse-dragging')
    await page.mouse.up()

    await expect.poll(() => titles(list)).toEqual([before[1], before[0], before[2]])
    await expect(lifted(list)).toHaveCount(0)
  })

  test('움직임 줄이기 설정에서는 키우지 않고 그림자만 남긴다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const list = await openEditor(page)
    const first = list.locator(':scope > li').nth(0)
    const from = await center(first)

    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x, from.y + 8, { steps: 4 })
    await expect(lifted(list)).toHaveCount(1)

    const lift = list.locator(':scope > li.shadow-md')
    await expect(lift).toHaveCSS('scale', 'none')
    await expect(lift).not.toHaveCSS('box-shadow', 'none')
    await page.mouse.up()
  })

  test('버튼 위에서 시작한 누름은 끌기가 아니다', async ({ page }) => {
    const list = await openEditor(page)
    const before = await titles(list)

    const remove = list.locator(':scope > li').nth(0).getByRole('button', { name: '삭제' })
    const start = await center(remove)
    const below = await center(list.locator(':scope > li').nth(2))

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x, below.y, { steps: 12 })
    await expect(lifted(list)).toHaveCount(0)
    await page.mouse.up()

    expect(await titles(list)).toEqual(before)
  })

  test('▼ 버튼 클릭은 그대로 한 칸 옮긴다 — 끌기로 잡히지 않는다', async ({ page }) => {
    const list = await openEditor(page)
    const before = await titles(list)

    await list.locator(':scope > li').nth(0).getByRole('button', { name: '아래로 이동' }).click()

    await expect.poll(() => titles(list)).toEqual([before[1], before[0], before[2]])
    await expect(lifted(list)).toHaveCount(0)
  })
})

test.describe('순서 편집 — 터치로 카드를 끈다 (#1029)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  /**
   * **CDP 로 터치를 보낸다.** Playwright 의 `touchscreen` 은 `tap` 하나뿐이라 누르고 끄는
   * 동작을 만들 수 없다. `Input.dispatchTouchEvent` 는 브라우저 입력 파이프라인을 그대로
   * 지나므로 **실제 스크롤·`pointercancel`** 이 일어난다 — 이 스펙이 보려는 것이 그것이다.
   */
  async function touch(page: Page) {
    const client: CDPSession = await page.context().newCDPSession(page)
    return {
      start: (x: number, y: number) =>
        client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        }),
      /** 손가락을 `steps` 번에 나눠 옮긴다 — 한 번에 옮기면 브라우저가 스크롤로 풀지 못한다 */
      moveTo: async (from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) => {
        for (let step = 1; step <= steps; step += 1) {
          const x = from.x + ((to.x - from.x) * step) / steps
          const y = from.y + ((to.y - from.y) * step) / steps
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y }],
          })
          await page.waitForTimeout(16)
        }
      },
      end: () => client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    }
  }

  /** 편집 목록을 화면 가운데로 — 자동 스크롤 구역(위아래 60px)에 걸리지 않게 한다 */
  async function centerList(page: Page, list: Locator) {
    await list.evaluate((node) => node.scrollIntoView({ block: 'center' }))
    await settle(page, list)
  }

  test('짧게 스와이프하면 화면이 스크롤된다 — 끌기가 아니다', async ({ page }) => {
    const list = await openEditor(page)
    await centerList(page, list)
    const before = await titles(list)
    const scrollBefore = await page.evaluate(() => window.scrollY)

    const finger = await touch(page)
    const from = await center(list.locator(':scope > li').nth(1))
    await finger.start(from.x, from.y)
    // 길게 누르기(0.3초)를 기다리지 않고 곧바로 위로 민다 — 화면을 내려 보려는 손짓이다
    await finger.moveTo(from, { x: from.x, y: from.y - 200 })
    await finger.end()

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore + 50)
    expect(await titles(list)).toEqual(before)
    await expect(lifted(list)).toHaveCount(0)
    await shot(page, 'touch-swipe-scrolled')
  })

  test('0.3초 길게 누른 뒤 끌면 순서가 바뀌고, 화면은 스크롤되지 않는다', async ({ page }) => {
    const list = await openEditor(page)
    await centerList(page, list)
    const cards = list.locator(':scope > li')
    const before = await titles(list)
    const scrollBefore = await page.evaluate(() => window.scrollY)

    const finger = await touch(page)
    const from = await center(cards.nth(0))
    const to = await center(cards.nth(1))

    await finger.start(from.x, from.y)
    // 0.3초 전에는 아직 들리지 않는다
    await page.waitForTimeout(150)
    await expect(lifted(list)).toHaveCount(0)
    await page.waitForTimeout(250)
    await expect(lifted(list)).toHaveCount(1)

    await finger.moveTo(from, { x: to.x, y: to.y + 12 })
    await shot(page, 'touch-dragging')
    // 들린 카드를 살짝 키워도 좁은 화면에 가로 스크롤이 생기지 않는다 (DESIGN.md §7 375px 규칙)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0)
    await finger.end()

    await expect.poll(() => titles(list)).toEqual([before[1], before[0], before[2]])
    await expect(lifted(list)).toHaveCount(0)
    // 끄는 동안 막은 스크롤이 새지 않았다 (자동 스크롤 구역 밖이다)
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(2)
  })
})
