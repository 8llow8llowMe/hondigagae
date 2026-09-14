import { expect, type Page, test } from '@playwright/test'

/**
 * **없는 리소스의 HTTP 상태 코드** — 이슈 #563.
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 화면이 아니라 **응답의 상태 코드**다. `notFound()` 를 부르는 것과 404 가
 * 나가는 것은 별개의 사건이라 — 조상에 `loading.tsx` 가 하나 생기면 Suspense 경계가 먼저
 * 스트리밍을 시작해 **not-found UI 는 그대로인 채 상태만 200 으로 남는다**(soft 404,
 * `docs/architecture-guide.md` §7). 화면을 보는 테스트는 이 회귀를 원리적으로 못 잡는다.
 *
 * 실제로 못 잡았다: `/pets` 에 `loading.tsx` 가 있어 자식인 `[petId]` 까지 감쌌고,
 * `/pets/{없는 id}` 가 `존재하지 않는 반려견이에요` 를 그리면서 200 으로 나갔다.
 *
 * ### 문구가 아니라 코드만 본다
 *
 * 화면 문구는 지금이 맞다 — 여기서 못박는 것은 **크롤러·모니터링이 읽는 값**이다.
 * 그래서 상태 코드와 "그 화면이 맞게 그려졌다" 는 최소 단서 하나만 확인한다.
 */
test.describe('없는 리소스의 상태 코드 (#563)', () => {
  /** 문서 요청 자체의 상태. `page.goto` 의 응답이 곧 그 값이다 */
  async function statusOf(page: Page, path: string): Promise<number> {
    const response = await page.goto(path)
    expect(response, `${path} 요청이 응답을 받지 못했다`).not.toBeNull()
    return response?.status() ?? 0
  }

  test('없는 일정은 404 다', async ({ page }) => {
    expect(await statusOf(page, '/plans/123456789012999999')).toBe(404)
  })

  test('없는 주소는 404 다', async ({ page }) => {
    expect(await statusOf(page, '/definitely-not-a-page')).toBe(404)
  })

  test('없는 장소는 404 다', async ({ page }) => {
    expect(await statusOf(page, '/places/999999999999')).toBe(404)
  })

  /*
    **여기가 회귀의 자리다.** `notFound()` 는 처음부터 불리고 있었는데도 200 이 나갔다 —
    `app/(main)/pets/loading.tsx` 가 자식 세그먼트까지 감쌌기 때문이다. 목록을
    `pets/(list)/` 로 옮겨 `[petId]` 를 경계 밖으로 뺐다 (URL 은 그대로다).
  */
  test('없는 반려견은 404 다 — 목록의 loading.tsx 가 상세를 감싸지 않는다', async ({ page }) => {
    expect(await statusOf(page, '/pets/999999')).toBe(404)
    await expect(page.getByText('존재하지 않는 반려견이에요')).toBeVisible()
  })

  /*
    **이것만 404 가 아니다.** 컨트롤러가 `@PathVariable long` 이라 숫자가 아닌 id 의 답은
    400(`PLACE_113`)으로 정해져 있다 (`docs/screen-inventory.md` §3). 화면도 그 400 을
    구분해 `요청 조건이 올바르지 않아요` 를 그리는데 응답만 200 으로 나갔다.
  */
  test('형식이 틀린 장소 id 는 400 이다 — 404 가 아니다', async ({ page }) => {
    expect(await statusOf(page, '/places/abc')).toBe(400)
    // `h1` 은 `sr-only` 로 같은 문장을 한 번 더 쓴다 — 보이는 쪽인 상태 제목만 잡는다
    await expect(
      page.getByRole('heading', { name: '요청 조건이 올바르지 않아요', level: 2 }),
    ).toBeVisible()
  })
})
