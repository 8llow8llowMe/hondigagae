import { expect, type Page, test } from '@playwright/test'

/**
 * **다른 브라우저·기기에서도 초안을 담을 수 있다** — 이슈 #498 (서버 쪽 #488).
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 마크업이 아니라 **"보관본 없이도 담기가 열린다"** 는 상태다. 조건은
 * `sessionStorage` 에 있었고 그것은 node 환경 렌더 테스트에 존재하지 않는다 — 있으나
 * 없으나 같은 결과가 나와 회귀를 못 잡는다.
 *
 * ### 재현 조건을 어떻게 만드나
 *
 * **Playwright 컨텍스트는 매번 빈 `sessionStorage` 로 시작한다** (`storageState` 는 쿠키와
 * `localStorage` 만 나른다). 그래서 폼을 거치지 않고 API 로 작업을 낸 뒤 그 주소를 열면,
 * 그 화면이 보는 상태가 **정확히 "다른 브라우저에서 주소를 연 사용자"** 와 같다.
 *
 * **폼을 거치지 않는 것이 핵심이다** — 폼으로 내면 그 탭에 보관본이 생겨 재현이 깨진다.
 */

/** 폼을 거치지 않고 작업을 낸다 — 보관본을 만들지 않기 위해서다 */
async function submitWithoutForm(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const petList = (await (await fetch('/api/bff/members/me/pets')).json()) as {
      dataBody: { pets: { petId: string }[] }
    }

    const day = (offset: number) => {
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
      const month = String(target.getMonth() + 1).padStart(2, '0')
      const date = String(target.getDate()).padStart(2, '0')
      return `${target.getFullYear()}-${month}-${date}`
    }

    const response = await fetch('/api/bff/ai-plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        areaCode: '39',
        startDate: day(30),
        endDate: day(32),
        petIds: petList.dataBody.pets.slice(0, 1).map((pet) => pet.petId),
      }),
    })

    const submitted = (await response.json()) as { dataBody: { jobId: string } }
    return submitted.dataBody.jobId
  })
}

test.describe('보관본 없이 연 작업 주소 (#498)', () => {
  test('초안을 담을 수 있다 — 조건을 다시 묻지 않는다', async ({ page }) => {
    await page.goto('/plans')
    const jobId = await submitWithoutForm(page)

    await page.goto(`/ai-plans/jobs/${jobId}`)

    /*
      보관본이 없다는 것이 이 테스트의 전제다. **`window.` 를 붙여 읽는다** —
      `no-restricted-globals` 가 맨 `sessionStorage` 를 막는데, 그 규칙이 지키려는 것은
      "앱이 토큰을 스토리지에 두지 않는다"(`auth-guide.md` §2)이고 여기는 **비어 있음을
      확인하는** 자리다.
    */
    expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0)

    // mock 은 조회 횟수로 진행한다 — 폴링이 완료에 닿을 때까지 기다린다
    await expect(page.getByRole('button', { name: '내 일정에 담기' })).toBeVisible({
      timeout: 20_000,
    })

    // 예전에는 여기가 "조건을 다시 알려 주세요" 였다 — 초안은 보이고 담기는 막혔다
    await expect(page.getByText('조건을 다시 알려 주세요')).toHaveCount(0)
  })

  test('대기 화면의 약속이 담기까지 말한다', async ({ page }) => {
    await page.goto('/plans')
    const jobId = await submitWithoutForm(page)

    await page.goto(`/ai-plans/jobs/${jobId}`)

    await expect(page.getByText('다른 기기에서 주소를 열어도 이어서 담을 수 있어요')).toBeVisible()
  })
})

/**
 * **AI 조건 폼의 시작일 달력이 지난 날짜를 막는가** — 이슈 #562.
 *
 * ### 왜 e2e 인가
 *
 * `min` 이 `disabled` 로 바뀌는 것은 `Calendar` 안의 계산이고, 그 계산에 들어가는
 * `today` 는 **서버가 내려보낸 값**이다 (`app/(main)/ai-plans/new/page.tsx`). node 환경
 * 렌더 테스트는 달력을 여는 상호작용을 돌리지 못해(`docs/testing-guide.md` §1) 이 경로를
 * 끝까지 볼 수 없다 — 실제로 못 잡았다.
 *
 * ### 왜 어제·내일인가
 *
 * 고정 날짜를 적으면 그날이 지나는 순간 스펙이 거짓이 된다. 기준은 **"오늘"** 이므로
 * 판정도 오늘에서 상대적으로 만든다. 어제와 내일은 같은 달에 있을 때가 대부분이고,
 * 달을 넘는 날(1일·말일)에도 달력이 **인접 달 칸을 함께 그리므로** 격자에 들어 있다.
 */
test.describe('AI 조건 폼 시작일 최소일 (#562)', () => {
  /** `2026년 9월 13일 (일)` — `calendar.tsx` 의 `dayLabel` 과 같은 서식 */
  function dayLabel(offset: number): string {
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][target.getDay()]
    return `${target.getFullYear()}년 ${target.getMonth() + 1}월 ${target.getDate()}일 (${weekday})`
  }

  test('지난 날짜는 고를 수 없다 — 서버 400 왕복 뒤에 거절하지 않는다', async ({ page }) => {
    await page.goto('/ai-plans/new')

    await page.getByLabel('여행 시작일').click()
    await expect(page.getByRole('dialog', { name: '여행 시작일' })).toBeVisible()

    // 어제는 막히고 오늘·내일은 열려 있다 — 경계가 오늘이라는 뜻이다
    await expect(page.getByRole('button', { name: dayLabel(-1) })).toBeDisabled()
    await expect(page.getByRole('button', { name: dayLabel(0) })).toBeEnabled()
    await expect(page.getByRole('button', { name: dayLabel(1) })).toBeEnabled()
  })

  test('시작일을 고르기 전에도 종료일이 지난 날짜를 막는다', async ({ page }) => {
    await page.goto('/ai-plans/new')

    await page.getByLabel('여행 종료일').click()
    await expect(page.getByRole('dialog', { name: '여행 종료일' })).toBeVisible()

    // 시작일이 오늘 이후로 묶인 이상 종료일이 그보다 이를 수 없다
    await expect(page.getByRole('button', { name: dayLabel(-1) })).toBeDisabled()
    await expect(page.getByRole('button', { name: dayLabel(0) })).toBeEnabled()
  })
})
