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
    **보기를 바꿔도 조건이 남는다.** 조건은 URL 에 남아 `nearbyPlacesPath` 가 그대로
    싣는다 — 그 전제가 깨지면 목록에서 좁혀 둔 검색이 지도로 넘어갈 때 조용히 풀린다.

    **지도 갈래에도 검색 입력이 생겼다** (#596) — 아래 `지도 보기 검색` 절이 잰다.
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

/**
 * 지도 보기의 검색 — 이슈 #596.
 *
 * #431 이 *"지도 갈래에는 두지 않는다"* 로 접었던 결정을 뒤집은 자리다. 뒤집은 이유가
 * **지도에서 검색어가 걸린 것을 알 방법이 없다**는 것이라, 잴 것도 그것이다: `?keyword=`
 * 를 달고 들어오면 화면이 그 글자를 되돌려 주는가, 그리고 지우는 길이 있는가.
 *
 * **`MOCK_API=true` 라 카카오 SDK 는 뜨지 않는다** — e2e 에서 `/places` 지도 갈래는 SDK
 * 실패 폴백으로 떨어진다. 그 갈래에 검색이 남아야 한다는 것 자체가 #596 의 결정 하나라
 * (폴백에는 필터 칩도 `초기화` 도 없어 검색어를 지울 길이 사라진다), 여기서 재는 것이 곧
 * 그 결정이다. 실제 SDK 위 오버레이·패널 자리는 소스 단언이 잠근다
 * (`src/features/place/place-map-search.test.ts`).
 */
test.describe('지도 보기 검색 (#596)', () => {
  test('지도 갈래에도 검색이 있고 URL 의 검색어를 들고 있다', async ({ page }) => {
    await page.goto(`/places?keyword=${encodeURIComponent(KEYWORD)}`)

    await expect(
      page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' }).first(),
    ).toHaveValue(KEYWORD)
  })

  test('지도 갈래에서 제출하면 keyword 가 URL 에 실린다', async ({ page }) => {
    await page.goto('/places')

    /*
      **폴백이 자리를 잡은 뒤에 친다.** SDK 실패는 지도 스켈레톤이 한 번 그려진 뒤에 오고
      그때 서브트리가 통째로 교체된다 — 교체 전 입력에 채우면 떨어져 나간 노드에 엔터를
      치게 되어 아무 일도 일어나지 않는다 (#581 과 같은 성질).
    */
    await expect(page.getByRole('main').locator('li').first()).toBeVisible()

    const box = page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' }).first()
    await box.fill(KEYWORD)
    await box.press('Enter')

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(KEYWORD)}`))
  })

  /*
    **폴백에는 필터 칩도 `초기화` 도 없다.** 검색어를 지울 길이 이 입력 하나뿐이라,
    비우고 제출하면 조건이 풀려야 한다 (`normalizeKeyword` 가 빈 값을 `null` 로).
  */
  test('검색창을 비우고 제출하면 검색어가 풀린다', async ({ page }) => {
    await page.goto(`/places?keyword=${encodeURIComponent(KEYWORD)}`)

    /*
      **`role="status"` 만으로는 모자라다.** 안내 줄은 SDK 실패 **직후**에 뜨지만 그때
      목록은 아직 조회 중이고, 데이터가 도착하며 서브트리가 한 번 더 그려진다 — `fill`
      과 `press` 사이에 그 교체가 끼면 떨어져 나간 입력에 엔터를 치게 된다. 전체 스위트의
      부하에서 실제로 났다. **행이 찬 뒤**가 진짜 안정 지점이다.
    */
    await expect(page.getByRole('main').locator('li').first()).toBeVisible()

    const box = page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' }).first()
    await box.fill('')
    await box.press('Enter')

    await expect(page).not.toHaveURL(/keyword=/)
  })

  /*
    **담기 화면은 켜지 않는다** — 그 화면은 목록 갈래에도 검색이 없어서, 지도에만 켜면
    같은 화면의 두 보기가 다른 도구를 갖는다 (`PlaceMapView` 의 `searchable` 주석).
  */
  test('담기 화면 지도에는 검색이 없다', async ({ page }) => {
    await page.goto('/plans/223456789012000001/days/1/add')

    await expect(page.getByRole('status').first()).toBeVisible()
    await expect(page.getByRole('searchbox', { name: '장소 이름·주소로 찾기' })).toHaveCount(0)
  })
})
