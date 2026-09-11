import type { Locator, Page } from '@playwright/test'

/**
 * 3층 표면(`DESIGN.md §0`) 검증용 실측 헬퍼.
 *
 * **픽셀 비교가 아니라 계산된 값을 읽는다.** 3층 표면 검토에서 실제로 결함을 잡아낸
 * 것이 스크린샷 diff 가 아니라 `getComputedStyle` · `getBoundingClientRect` 였고,
 * 이 값들은 OS·폰트에 흔들리지 않아 CI 에서도 그대로 쓸 수 있다 (이슈 #467).
 */

/** 3층 표면 토큰. `app/globals.css` 가 정본이고 여기서 이름으로 읽어 온다 */
export async function token(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim(),
    name,
  )
}

export type SurfaceStyle = {
  backgroundColor: string
  boxShadow: string
  borderTopLeftRadius: string
  borderTopWidth: string
  borderLeftWidth: string
}

export async function surfaceStyle(card: Locator): Promise<SurfaceStyle> {
  return card.evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      borderTopLeftRadius: style.borderTopLeftRadius,
      borderTopWidth: style.borderTopWidth,
      borderLeftWidth: style.borderLeftWidth,
    }
  })
}

/** 요소의 왼쪽 세로선 (뷰포트 기준 px). 기준선 어긋남을 재는 데 쓴다 */
export async function leftEdge(locator: Locator): Promise<number> {
  const box = await locator.first().boundingBox()
  if (box === null) throw new Error('요소가 보이지 않아 위치를 잴 수 없다')
  return Math.round(box.x)
}

/** 가로 스크롤이 생겼는지. 카드가 뷰포트를 넘치면 여기서 잡힌다 */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

/**
 * 문서 개요 — 제목 레벨이 건너뛰는지, 같은 카드에 `h2` 가 둘인지 본다.
 *
 * **`checkVisibility()` 로 거른다.** Suspense 전환 중에는 `loading.tsx` 의 트리와 실화면
 * 트리가 잠시 **함께 DOM 에 있고**, Next 가 옛 트리를 `display: none` 으로 감춘다. 그냥
 * 세면 `sr-only` `h1` 이 둘로 잡혀 "h1 은 하나" 단언이 간헐적으로 깨진다 — 결함이 아니라
 * 계측 함정이다. `sr-only`(1px + clip)는 `display` 가 살아 있어 그대로 포함된다.
 */
export async function headingOutline(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4')]
      .filter((el) => el.checkVisibility())
      .map((el) => `${el.tagName}:${(el.textContent ?? '').trim()}`),
  )
}

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
} as const
