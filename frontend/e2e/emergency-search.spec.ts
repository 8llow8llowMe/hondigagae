import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * 병원·약국 이름·주소 검색 — 이슈 #584.
 *
 * ### 왜 e2e 인가
 *
 * 검색은 **입력 → 제출 → URL → 목록**이 한 줄로 이어져야 뜻이 있다. 그 사슬의 어느
 * 고리도 node 환경 렌더 테스트로는 볼 수 없다 — 폼 제출도, `router.replace` 도, 바뀐
 * `searchParams` 로 다시 좁혀지는 목록도 실제 브라우저에서만 일어난다.
 * `place-search.spec.ts`(#431)와 같은 이유이고 같은 모양이다.
 *
 * **다른 점 하나: 이 화면은 서버로 검색어를 보내지 않는다.** 반경 안 전량을 받아 화면에서
 * 좁힌다(`facility-filters.ts`). 그래서 여기서 재는 것은 "요청이 나갔는가" 가 아니라
 * **"목록이 실제로 줄었는가"** 다.
 *
 * 목 데이터(`src/lib/api/mock/emergency-data.ts`)는 네 곳이다 — 제주24시동물병원 ·
 * 한라동물병원 · 서귀포동물병원 · 가까운약국.
 */
const SEARCH = messages.emergency.searchLabel
const LIST = '#emergency-list li'

/** 이름에만 있는 말 — 한라동물병원 한 곳 */
const BY_NAME = '한라'
/** 주소에만 있는 말 — 서귀포시의 한 곳 */
const BY_ADDR = '서귀포시'
const NO_MATCH = '존재하지않는시설ZZZ'

/**
 * **목록이 실제로 찬 뒤에 잰다.** `/emergency` 는 서버 프리페치가 없고 좌표를 먼저 물어
 * (`getCurrentPosition`) 로딩 구간이 길다 — 골격만 있는 동안 센 0 은 검색 결과가 아니다.
 */
async function settled(page: Page): Promise<number> {
  await expect(page.locator(LIST).first()).toBeVisible()
  return page.locator(LIST).count()
}

test.describe('병원·약국 검색 (#584)', () => {
  test('엔터로 제출하면 URL 에 keyword 가 실리고 목록이 좁혀진다', async ({ page }) => {
    await page.goto('/emergency?view=list')

    const before = await settled(page)
    expect(before).toBeGreaterThan(1)

    await page.getByRole('searchbox', { name: SEARCH }).fill(BY_NAME)
    await page.getByRole('searchbox', { name: SEARCH }).press('Enter')

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(BY_NAME)}`))
    await expect(page.locator(LIST)).toHaveCount(1)
  })

  test('검색 버튼으로도 같은 일이 일어난다', async ({ page }) => {
    await page.goto('/emergency?view=list')
    await settled(page)

    await page.getByRole('searchbox', { name: SEARCH }).fill(BY_NAME)
    await page.getByRole('button', { name: messages.emergency.searchAction, exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(BY_NAME)}`))
    await expect(page.locator(LIST)).toHaveCount(1)
  })

  /* 이름과 주소를 한 건초더미로 본다 — 주소만으로도 찾혀야 한다 */
  test('주소의 말로도 찾는다', async ({ page }) => {
    await page.goto(`/emergency?view=list&keyword=${encodeURIComponent(BY_ADDR)}`)

    await expect(page.locator(LIST)).toHaveCount(1)
    await expect(page.locator(LIST).first()).toContainText('서귀포')
  })

  /*
    **검색어와 칩이 함께 걸린다.** 둘 중 하나만 적용되면 사용자는 자기가 건 조건이 조용히
    무시되는 화면을 본다.
  */
  test('검색어와 유형 필터가 함께 적용된다', async ({ page }) => {
    await page.goto('/emergency?view=list&type=ANIMAL_PHARMACY')

    const pharmacies = await settled(page)

    await page.getByRole('searchbox', { name: SEARCH }).fill(BY_NAME)
    await page.getByRole('searchbox', { name: SEARCH }).press('Enter')

    /* 약국 중에 "한라" 는 없다 — 0건 안내로 떨어진다 */
    expect(pharmacies).toBeGreaterThan(0)
    await expect(page.locator(LIST)).toHaveCount(0)
    await expect(page.getByRole('main')).toContainText(BY_NAME)
  })

  /*
    **입력은 URL 을 따라간다.** 뒤로가기·초기화가 `keyword` 를 바꿨는데 입력이 제 값을
    들고 있으면 화면에 보이는 검색어와 실제 조건이 갈린다.
  */
  test('주소로 직접 들어오면 입력에 검색어가 채워져 있다', async ({ page }) => {
    await page.goto(`/emergency?view=list&keyword=${encodeURIComponent(BY_NAME)}`)

    await expect(page.getByRole('searchbox', { name: SEARCH })).toHaveValue(BY_NAME)
  })

  /*
    **초기화가 검색어도 지운다.** 초기화는 `DEFAULT_FACILITY_FILTERS` 로 가고 그 안에서
    `keyword` 는 `null` 이다 — 검색어만 따로 남으면 "초기화했는데 결과가 그대로" 가 된다.
  */
  test('필터 초기화가 검색어까지 지운다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/emergency?view=list&keyword=${encodeURIComponent(BY_NAME)}&open24Only=true`)

    await page.getByRole('button', { name: messages.place.resetFilters }).first().click()

    await expect(page).not.toHaveURL(/keyword=/)
    await expect(page.getByRole('searchbox', { name: SEARCH })).toHaveValue('')
  })

  /*
    **지도로 넘어가도 조건이 남는다.** 지도 갈래에는 검색 입력을 두지 않았고(`/places` 와
    같은 판단) 조건은 URL 에 남는다. 그 전제가 깨지면 목록에서 좁혀 둔 검색이 지도로
    넘어갈 때 조용히 풀린다.
  */
  test('지도로 넘어가도 keyword 가 남는다', async ({ page }) => {
    await page.goto(`/emergency?view=list&keyword=${encodeURIComponent(BY_NAME)}`)

    await page.getByRole('link', { name: messages.map.showMap }).click()

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(BY_NAME)}`))
  })

  /*
    **375 에서도 검색이 보여야 한다** — 카드 머리에 둔 **유일한 근거**가 그것이다
    (필터 레일은 `hidden lg:block` 이라 거기 두면 1024 미만에서 사라진다). 나머지 케이스는
    전부 기본(데스크톱) 뷰포트라, 이 단언이 없으면 레일로 옮기는 변경이 조용히 통과한다.
  */
  test('모바일 폭에서도 목록 갈래에 검색이 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/emergency?view=list')

    await expect(page.getByRole('searchbox', { name: SEARCH })).toBeVisible()
  })

  /* 0건이면 무엇으로 찾았는지 되돌려 주고, 지우는 길을 함께 준다 */
  test('0건이면 검색어를 되돌려 주고 지우는 버튼을 준다', async ({ page }) => {
    await page.goto(`/emergency?view=list&keyword=${encodeURIComponent(NO_MATCH)}`)

    await expect(page.getByRole('main')).toContainText(NO_MATCH)
    /* `reliefKeyword` 는 `{n}` 치환이라 앞부분으로 찾는다 */
    await expect(page.getByRole('button', { name: /검색어 지우면/ })).toBeVisible()
  })
})

/**
 * 지도 갈래의 검색 — 이슈 #584.
 *
 * `/places`(#431)가 "지도 갈래에는 두지 않는다" 로 접었던 결정을 뒤집은 자리다. 뒤집은
 * 이유는 **지도에서 검색어가 걸린 것을 알 방법이 없었다**는 것이라, 잴 것도 그것이다:
 * `?keyword=` 를 달고 들어오면 화면이 그 글자를 되돌려 주는가.
 *
 * **`MOCK_API=true` 라 카카오 SDK 는 뜨지 않는다** — e2e 환경에서 `/emergency` 의 지도
 * 갈래는 SDK 실패 폴백으로 떨어진다. 그 갈래에도 검색이 남아야 한다는 것 자체가 #584 의
 * 결정 하나라(`EmergencyFilterChips` 에는 `초기화` 가 없어 검색어를 지울 길이 없어진다),
 * 여기서 재는 것이 곧 그 결정이다. 실제 SDK 위 오버레이 자리는 소스 단언이 잠근다
 * (`emergency-list-view.test.ts` — 지도 갈래는 검색을 두 자리에 둔다).
 */
test.describe('지도 갈래 검색 (#584)', () => {
  test('지도 갈래에도 검색이 있고 URL 의 검색어를 들고 있다', async ({ page }) => {
    await page.goto(`/emergency?keyword=${encodeURIComponent(BY_NAME)}`)

    await expect(page.getByRole('searchbox', { name: SEARCH }).first()).toHaveValue(BY_NAME)
  })

  test('지도 갈래에서 검색하면 URL 에 실리고 목록이 좁혀진다', async ({ page }) => {
    await page.goto('/emergency')

    /*
      **폴백이 자리를 잡은 뒤에 친다.** SDK 실패는 지도 스켈레톤이 한 번 그려진 뒤에
      오고, 그때 서브트리가 통째로 교체된다 — 교체 전 입력에 채우면 떨어져 나간 노드에
      엔터를 치게 되어 아무 일도 일어나지 않는다 (`e2e/helpers/layout.ts` 가 같은 교체를
      두고 적어 둔 #581 과 같은 성질이다).
    */
    await expect(page.getByRole('status').first()).toBeVisible()

    const rows = page.getByRole('main').locator('li')
    const before = await rows.count()
    expect(before).toBeGreaterThan(1)

    const box = page.getByRole('searchbox', { name: SEARCH }).first()
    await box.fill(BY_NAME)
    await box.press('Enter')

    await expect(page).toHaveURL(new RegExp(`keyword=${encodeURIComponent(BY_NAME)}`))
    await expect(rows).toHaveCount(1)
  })

  /*
    **폴백에는 보기 토글이 없다** — 그래서 검색어를 지울 길이 `초기화` 도 아닌 이 입력
    하나뿐이다. 비우고 제출하면 조건이 풀려야 한다 (`normalizeKeyword` 가 빈 값을 `null` 로).
  */
  test('검색창을 비우고 제출하면 검색어가 풀린다', async ({ page }) => {
    await page.goto(`/emergency?keyword=${encodeURIComponent(BY_NAME)}`)
    await expect(page.getByRole('status').first()).toBeVisible()

    const box = page.getByRole('searchbox', { name: SEARCH }).first()
    await expect(box).toHaveValue(BY_NAME)

    await box.fill('')
    await box.press('Enter')

    await expect(page).not.toHaveURL(/keyword=/)
  })
})
