import { expect, test } from '@playwright/test'

/**
 * 장소 이름·주소 검색 — 이슈 #431 (계약은 #421).
 *
 * ### 왜 e2e 인가
 *
 * 검색은 **입력 → 제출 → URL → 재조회**가 한 줄로 이어져야 뜻이 있다. 그 사슬의 어느
 * 고리도 node 환경 렌더 테스트로는 볼 수 없다 — 폼 제출도, `router.replace` 도,
 * 바뀐 `searchParams` 로 다시 도는 조회도 실제 브라우저에서만 일어난다.
 *
 * **엔터 제출을 특히 잰다.** 검색창에서 엔터가 안 먹는 것은 버튼이 멀쩡해도 고장이고,
 * 암묵적 폼 제출은 마크업(`<form>` + `type="submit"`)에 달려 있어 조용히 깨진다.
 */
const KEYWORD = '미술관'

test.describe('장소 검색 (#431)', () => {
  test('엔터로 제출하면 URL 에 keyword 가 실리고 목록이 좁혀진다', async ({ page }) => {
    await page.goto('/places?view=list')

    const before = await page.locator('#place-list li').count()
    expect(before).toBeGreaterThan(0)

    await page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' }).fill(KEYWORD)
    await page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' }).press('Enter')

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(KEYWORD)}`))
    await expect(page.locator('#place-list li')).not.toHaveCount(before)
  })

  test('검색 버튼으로도 같은 일이 일어난다', async ({ page }) => {
    await page.goto('/places?view=list')

    await page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' }).fill(KEYWORD)
    await page.getByRole('button', { name: '검색', exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(KEYWORD)}`))
  })

  /*
    **보기를 바꿔도 조건이 남는다.** 지도 갈래에는 검색 입력을 두지 않았고(필터 칩·레일과
    같은 판단), 조건은 URL 에 남아 `nearbyPlacesPath` 가 그대로 싣는다. 그 전제가 깨지면
    목록에서 좁혀 둔 검색이 지도로 넘어갈 때 조용히 풀린다.
  */
  test('지도로 넘어가도 keyword 가 남는다', async ({ page }) => {
    await page.goto(`/places?view=list&keyword=${encodeURIComponent(KEYWORD)}`)

    await page.getByRole('link', { name: '지도' }).click()

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(KEYWORD)}`))
  })

  /*
    **초기화가 검색어도 지운다.** 초기화는 `DEFAULT_PLACE_FILTERS` 로 가고 그 안에서
    `keyword` 는 `null` 이다 — 검색어만 따로 남으면 "초기화했는데 결과가 그대로" 가 된다.
  */
  test('필터 초기화가 검색어까지 지운다', async ({ page }) => {
    await page.goto(`/places?view=list&keyword=${encodeURIComponent(KEYWORD)}&indoor=true`)

    await page.getByRole('button', { name: '초기화' }).first().click()

    await expect(page).not.toHaveURL(/keyword=/)
    await expect(page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' })).toHaveValue('')
  })

  /*
    **입력은 URL 을 따라간다.** 뒤로가기·초기화가 `keyword` 를 바꿨는데 입력이 제 값을
    들고 있으면, 화면에 보이는 검색어와 실제 조건이 갈린다.
  */
  test('주소로 직접 들어오면 입력에 검색어가 채워져 있다', async ({ page }) => {
    await page.goto(`/places?view=list&keyword=${encodeURIComponent(KEYWORD)}`)

    await expect(page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' })).toHaveValue(
      KEYWORD,
    )
  })

  test('0건이면 무엇으로 찾았는지 되돌려 준다', async ({ page }) => {
    await page.goto('/places?view=list&keyword=존재하지않는장소이름ZZZ')

    await expect(page.getByRole('main')).toContainText('존재하지않는장소이름ZZZ')
  })
})
