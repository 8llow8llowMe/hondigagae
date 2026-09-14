import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { VIEWPORTS } from './helpers/layout'

/**
 * 돌아가기가 제목 줄로 들어간다 — 이슈 #539.
 *
 * **유닛이 못 보는 것을 본다.** `back-link.test.ts` 는 클래스가 붙었는지까지만 알고,
 * 그 클래스가 실제로 줄바꿈을 만드는지·44px 가 정말 44px 인지는 모른다. 여기서는 잰다.
 * 스크린샷이 아니라 계산된 값을 단언한다 (#467) — OS·폰트에 안 흔들려 CI 기준선 관리가
 * 필요 없다.
 *
 * **`testing-guide.md` §12 경계 안이다.** §12 는 "화면 고유의 배치를 Playwright 로 잠그지
 * 않는다" 인데, 여기서 잠그는 것은 화면 배치가 아니라 **공용 컴포넌트(`BackLink`)의 반응형
 * 계약**이다. 같은 계약을 네 자리에서 확인하는 이유가 그것이다 — 한 화면만 보면 그 화면의
 * 배치를 잠그는 것이 된다.
 *
 * **네 자리를 다 본다.** 첫 판에는 `add?view=list` 하나만 봤는데, 검토가 "가장 튼튼한
 * 갈래만 잠갔다" 를 지적했다 — 실제로 `md:basis-full` 이 데스크톱 링크 상자를 줄 전체
 * (1832px)로 키운 회귀를 9건 중 아무것도 잡지 못했다.
 */

const PLAN = '223456789012000001'

/** `inset` 이 갈리는 두 갈래(목록 `card` · 지도 `main`)와, 폭 가드가 없던 두 화면 */
/**
 * `title` 은 **보이는** 제목의 선택자다.
 *
 * **`h1` 로 고정할 수 없다** (#556). 담기 목록은 제목이 카드 머리로 들어가며 보이는 쪽이
 * `h2` 가 되고 `h1` 은 `sr-only` 로 레일 앞에 남았다 — `sr-only` 는 1px 상자라 Playwright
 * 에게는 여전히 "보이는" 요소여서, `h1` 을 집으면 화면에 없는 것을 재게 된다.
 */
const SCREENS = [
  {
    name: 'add(list)',
    path: `/plans/${PLAN}/days/1/add?view=list`,
    label: messages.plan.addPlaceBack,
    title: 'h2#plan-add-place-heading',
  },
  {
    name: 'add(map)',
    path: `/plans/${PLAN}/days/1/add`,
    label: messages.plan.addPlaceBack,
    title: 'h1',
  },
  {
    name: 'emergency',
    path: `/plans/${PLAN}/emergency`,
    label: messages.plan.emergencyBack,
    title: 'h1',
  },
  {
    name: 'regenerate',
    path: `/plans/${PLAN}/days/1/regenerate`,
    label: messages.plan.addPlaceBack,
    title: 'h1',
  },
] as const

type Box = { x: number; y: number; width: number; height: number }

/**
 * 두 요소가 **같은 줄**에 섰는지. 세로 구간이 겹치면 같은 줄이다.
 *
 * `top` 이 같은지 보지 않는 이유: 뒤로가기는 44px 링크고 `h1` 은 글줄이라 높이가 달라
 * 위 모서리가 애초에 안 맞는다. 잡으려는 것은 "나란히 섰는가" 이지 "위가 같은가" 가 아니다.
 */
function overlapsVertically(a: Box, b: Box): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height
}

async function boxes(
  page: Page,
  label: string,
  titleSelector: string,
): Promise<{ back: Box; title: Box }> {
  const back = await page.getByRole('link', { name: label, exact: true }).first().boundingBox()
  const title = await page.locator(titleSelector).first().boundingBox()

  expect(back).not.toBeNull()
  expect(title).not.toBeNull()
  return { back: back as Box, title: title as Box }
}

async function open(
  page: Page,
  path: string,
  size: (typeof VIEWPORTS)[keyof typeof VIEWPORTS],
  titleSelector: string,
): Promise<void> {
  await page.setViewportSize(size)
  await page.goto(path)
  await page.locator(titleSelector).first().waitFor()
}

for (const screen of SCREENS) {
  test.describe(`돌아가기 — 제목 줄 · ${screen.name} (#539)`, () => {
    test('모바일에서 제목 왼쪽, 같은 줄에 선다', async ({ page }) => {
      await open(page, screen.path, VIEWPORTS.mobile, screen.title)
      const { back, title } = await boxes(page, screen.label, screen.title)

      expect(overlapsVertically(back, title)).toBe(true)
      expect(back.x).toBeLessThan(title.x)
    })

    /*
      **아이콘만 남아도 손가락이 닿아야 한다** (DESIGN.md §7). 라벨이 `sr-only` 로 빠지면서
      가로가 아이콘 폭으로 쪼그라들 수 있는 자리다 — 44px 를 패딩으로 만드는 방식이 실제로
      44px 를 내는지 유닛은 알지 못한다.
    */
    test('모바일 터치 영역이 44x44 이상이다', async ({ page }) => {
      await open(page, screen.path, VIEWPORTS.mobile, screen.title)
      const { back } = await boxes(page, screen.label, screen.title)

      expect(back.width).toBeGreaterThanOrEqual(44)
      expect(back.height).toBeGreaterThanOrEqual(44)
    })

    /*
      **아이콘이 제목 첫 줄에 맞아야 한다.** `add` 갈래는 제목 줄 오른쪽에 46px 짜리
      `ViewToggle` 이 있어, 아이콘이 줄 전체 기준으로 정렬되면 제목보다 8px 아래로 내려간다
      (검토 실측). 1px 여유는 `-my-2` 가 스케일 안에 머무느라 받은 값이다 — 딱 맞는 7px 은
      arbitrary value 룰이 막는다.
    */
    test('모바일에서 아이콘 중심이 제목 첫 줄 중심에 선다', async ({ page }) => {
      await open(page, screen.path, VIEWPORTS.mobile, screen.title)
      const { back } = await boxes(page, screen.label, screen.title)

      // 제목의 **첫 줄** 중심 — 두 줄이 되어도 첫 줄 기준이어야 한다
      const firstLineCenter = await page
        .locator(screen.title)
        .first()
        .evaluate((el) => {
          const rect = el.getClientRects()[0]
          return rect === undefined ? null : rect.top + rect.height / 2
        })

      expect(firstLineCenter).not.toBeNull()
      expect(Math.abs(back.y + back.height / 2 - (firstLineCenter as number))).toBeLessThanOrEqual(
        2,
      )
    })

    for (const size of ['tablet', 'desktop'] as const) {
      /** **데스크톱은 지금 그대로다.** #539 가 바꾸기로 한 것은 모바일뿐이다. */
      test(`${size} 에서는 제목 위에 선다 — 텍스트 링크 그대로`, async ({ page }) => {
        await open(page, screen.path, VIEWPORTS[size], screen.title)
        const { back, title } = await boxes(page, screen.label, screen.title)

        expect(overlapsVertically(back, title)).toBe(false)
        expect(back.y).toBeLessThan(title.y)
      })

      /*
        **자리만 바꾸고 판정 영역은 바꾸지 않는다.** 첫 판은 `md:basis-full` 로 줄을 깼는데,
        `basis-full` 은 줄바꿈만이 아니라 **폭 자체**라 링크 상자가 줄 전체(실측 768에서
        680px, 1920에서 1840px)가 됐다 — 제목 오른쪽 빈 곳을 눌러도 뒤로 가고, 포커스 링이
        1832×44 로 그려졌다. y 좌표만 보던 단언은 그것을 잡지 못했다.
      */
      test(`${size} 에서 링크 상자가 글자 폭에 머문다 — 빈 곳을 눌러 뒤로 가지 않는다`, async ({
        page,
      }) => {
        await open(page, screen.path, VIEWPORTS[size], screen.title)
        const { back, title } = await boxes(page, screen.label, screen.title)

        expect(back.width).toBeLessThan(title.width)
        expect(back.width).toBeLessThan(300)
      })
    }

    /*
      **이름은 브레이크포인트를 타지 않는다.** 모바일에서 라벨이 시각적으로만 빠지므로
      접근성 이름은 세 폭에서 모두 같아야 한다 — `aria-label` 을 따로 두지 않은 이유가
      여기서 지켜진다.
    */
    for (const size of ['mobile', 'tablet', 'desktop'] as const) {
      test(`${size} 에서 접근성 이름이 같다`, async ({ page }) => {
        await open(page, screen.path, VIEWPORTS[size], screen.title)

        /*
          **`.first()` 가 필요하다.** `regenerate` 는 차단 상태에서 헤더 뒤로가기와 본문
          버튼이 **같은 이름으로 둘** 있어 strict mode 가 걸린다(실측). 여기서 보려는 것은
          "이름이 폭을 타지 않는다" 이지 "그 이름이 하나뿐이다" 가 아니다 — 중복 자체는
          모바일에서 헤더 라벨이 `sr-only` 라 화면에 드러나지 않는다.
        */
        await expect(
          page.getByRole('link', { name: screen.label, exact: true }).first(),
        ).toBeVisible()
      })
    }
  })
}
