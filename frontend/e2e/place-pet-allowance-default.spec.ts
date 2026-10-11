import { expect, test } from '@playwright/test'

/**
 * `/places` 첫 진입은 `동반 가능만` · 동반 미확인은 점선 `동반 정보 없음` — 이슈 #1379
 * (`docs/features/place/공통명세.md` D8).
 *
 * ### 왜 e2e 인가
 *
 * 기본 조건은 **페이지 파싱 · 칩 · URL 직렬화 · 초기화**가 같은 기본값(`placeFilterDefaults`)을 봐야
 * 맞게 돈다. 직렬화 규칙은 단위 테스트가 잠그지만, 페이지가 그 기본값으로 파싱하는지와 칩을 끈
 * 뒤 `?petAllowanceType=ALL` 로 다시 그리는지는 실제 라우팅에서만 보인다.
 *
 * mock 데이터의 동반 미확인 장소는 `제주현대미술관` 이다 (`lib/api/mock/place-data.ts`).
 */
const UNKNOWN_PLACE = '제주현대미술관'
const ALLOWED_ONLY = '반려견 동반 가능만'

test.describe('장소 찾기 — 동반 기본 조건 (#1379)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('빈 URL 은 동반 가능만이다 — 칩이 켜져 있고 미확인 장소가 없다', async ({ page }) => {
    await page.goto('/places?view=list')

    const list = page.locator('#place-list')
    await expect(list.getByRole('listitem').first()).toBeVisible()

    await expect(page.getByRole('button', { name: ALLOWED_ONLY })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(list.getByText(UNKNOWN_PLACE, { exact: true })).toHaveCount(0)
    await expect(list.getByText('동반 정보 없음')).toHaveCount(0)
  })

  test('칩을 끄면 ALL 로 적히고 미확인 장소가 점선 배지와 함께 선다', async ({ page }) => {
    await page.goto('/places?view=list')
    await expect(page.locator('#place-list').getByRole('listitem').first()).toBeVisible()

    await page.getByRole('button', { name: ALLOWED_ONLY }).click()

    await expect(page).toHaveURL(/petAllowanceType=ALL(&|$)/)
    await expect(page).toHaveURL(/view=list/)

    const row = page
      .locator('#place-list li')
      .filter({ has: page.getByRole('heading', { name: UNKNOWN_PLACE, exact: true }) })
    await expect(row).toBeVisible()

    const badge = row.getByText('동반 정보 없음', { exact: true })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveCSS('border-style', 'dashed')
  })

  test('초기화는 동반 가능만으로 돌아간다 — 그것이 이 화면의 기본이다', async ({ page }) => {
    await page.goto('/places?view=list&petAllowanceType=ALL')
    await expect(page.locator('#place-list').getByRole('listitem').first()).toBeVisible()

    await page.getByRole('button', { name: '초기화' }).first().click()

    await expect(page).toHaveURL(/\/places\?view=list$/)
    await expect(page.getByRole('button', { name: ALLOWED_ONLY })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
