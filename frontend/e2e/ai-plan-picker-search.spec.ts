import { expect, type Page, test } from '@playwright/test'

/**
 * AI 피커의 `검색` 탭 — 이슈 #431 (계약은 #421).
 *
 * ### 왜 e2e 인가
 *
 * 이 탭이 하는 일은 **탭 전환 → 검색어 제출 → 조회 → 고르기**가 한 줄로 이어지는 것이다.
 * 폼 제출도 `useQuery` 의 `enabled` 전환도 실제 브라우저에서만 일어나고, 시트는 로그인
 * 뒤에만 열려 node 환경 렌더로는 한 장도 볼 수 없다 (`testing-guide.md` §12).
 *
 * **"묻기 전에는 조회하지 않는다" 를 요청 수로 잰다** — 켜 두면 탭을 여는 것만으로 전체
 * 목록을 한 번 받는데, 그것은 마크업에 드러나지 않아 렌더 단언으로 잡을 수 없다.
 */
const SEARCH_PATH = /\/api\/bff\/places\?/

async function openPicker(page: Page): Promise<void> {
  await page.goto('/ai-plans/new')

  // 꼭 넣을 장소는 접혀 있는 상세 조건 안이다 — 폼의 기본 화면은 반려견·기간만 묻는다
  await page.getByRole('button', { name: /더 자세히 정할게요/ }).click()
  await page.getByRole('button', { name: '+ 장소 고르기' }).click()

  await expect(page.getByRole('tablist', { name: '장소 고르는 방법' })).toBeVisible()
}

test.describe('AI 피커 검색 탭 (#431)', () => {
  test('저장한 장소가 기본 탭이다', async ({ page }) => {
    await openPicker(page)

    await expect(page.getByRole('tab', { name: /저장한 장소/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('tab', { name: '검색' })).toHaveAttribute('aria-selected', 'false')
  })

  test('검색 탭을 열어도 묻기 전에는 조회하지 않는다', async ({ page }) => {
    const calls: string[] = []
    page.on('request', (request) => {
      if (SEARCH_PATH.test(request.url())) calls.push(request.url())
    })

    await openPicker(page)
    await page.getByRole('tab', { name: '검색' }).click()

    // 아직 묻지 않았다 — 빈 결과가 아니라 시작점이다
    await expect(page.getByText('이름이나 주소로 찾아 꼭 넣을 장소를 고르세요.')).toBeVisible()
    await page.waitForTimeout(800)

    expect(calls).toEqual([])
  })

  test('검색어를 내면 결과가 나오고 고를 수 있다', async ({ page }) => {
    await openPicker(page)
    await page.getByRole('tab', { name: '검색' }).click()

    const sheet = page.getByRole('tabpanel', { name: '검색' })
    await sheet.getByRole('searchbox').fill('미술관')
    await sheet.getByRole('searchbox').press('Enter')

    const first = sheet.getByRole('checkbox').first()
    await expect(first).toBeVisible()
    await first.check()

    // 고른 수가 시트 머리와 확정 버튼에 함께 반영된다
    await expect(page.getByRole('button', { name: /곳 담기/ })).toBeVisible()
  })

  test('0건이면 무엇으로 찾았는지 되돌려 준다', async ({ page }) => {
    await openPicker(page)
    await page.getByRole('tab', { name: '검색' }).click()

    const sheet = page.getByRole('tabpanel', { name: '검색' })
    await sheet.getByRole('searchbox').fill('존재하지않는장소이름ZZZ')
    await sheet.getByRole('searchbox').press('Enter')

    await expect(sheet).toContainText('존재하지않는장소이름ZZZ')
  })

  /*
    **ARIA 탭 패턴이다** — 좌우 화살표로 옮기고 포커스가 따라간다. roving tabindex 라
    선택이 옮겨 갔는데 포커스가 남으면 다음 화살표가 어디서 출발하는지 알 수 없다.
  */
  test('좌우 화살표로 탭을 옮기고 포커스가 따라간다', async ({ page }) => {
    await openPicker(page)

    await page.getByRole('tab', { name: /저장한 장소/ }).focus()
    await page.keyboard.press('ArrowRight')

    const search = page.getByRole('tab', { name: '검색' })
    await expect(search).toHaveAttribute('aria-selected', 'true')
    await expect(search).toBeFocused()
  })

  /*
    **검색어는 탭을 오가도 남는다.** 저장한 장소를 잠깐 확인하고 돌아왔는데 찾던 말이
    사라져 있으면 처음부터 다시 쳐야 한다.
  */
  test('탭을 오가도 검색어가 남는다', async ({ page }) => {
    await openPicker(page)
    await page.getByRole('tab', { name: '검색' }).click()

    const box = page.getByRole('tabpanel', { name: '검색' }).getByRole('searchbox')
    await box.fill('미술관')
    await box.press('Enter')

    await page.getByRole('tab', { name: /저장한 장소/ }).click()
    await page.getByRole('tab', { name: '검색' }).click()

    await expect(page.getByRole('tabpanel', { name: '검색' }).getByRole('searchbox')).toHaveValue(
      '미술관',
    )
  })
})
