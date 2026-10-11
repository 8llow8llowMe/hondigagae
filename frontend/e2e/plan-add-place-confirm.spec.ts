import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * 일정 담기 화면의 기본 조건 · 한 번 더 확인 · 채운 시각, 일정 상세의 탭 제목 — 이슈 #1383
 * (`docs/features/plan/일정상세-세부명세.md` D24).
 *
 * ### 왜 e2e 인가
 *
 * 세 조각이 각자 단위 테스트를 갖지만(`placeFilterDefaults` · `addPlaceConfirmReason` ·
 * `insertedItemStartTime` · `planDetailTitle`) 지키려는 것은 한 바퀴다 — 페이지가 담기 경로의 기본값으로
 * 파싱하는지, 첫 누름이 저장 요청을 보내지 않고 행 안에 이유를 세우는지, 두 번째 누름의 저장 본문이
 * 시각을 실어 토스트가 그 시각을 말하는지, `generateMetadata` 가 일정 이름을 쓰는지.
 *
 * mock 데이터의 동반 미확인 장소는 `제주현대미술관` 이다 (`lib/api/mock/place-data.ts`).
 */
const UNKNOWN_PLACE = '제주현대미술관'
const ALLOWED_ONLY = '반려견 동반 가능만'
const PLAN_TITLE = '시각 기본값 확인용 일정'

/** 동반 가능 장소 하나를 10:00 에 둔 1일차 일정을 만든다 */
async function createPlan(page: Page): Promise<string> {
  return page.evaluate(async (title) => {
    const list = (await (await fetch('/api/bff/places?areaCode=39&size=50')).json()) as {
      dataBody: {
        contents: { placeId: string; title: string; petAllowanceType: { code: string } }[]
      }
    }
    const anchor = list.dataBody.contents.find((place) => place.petAllowanceType.code === 'ALLOWED')
    if (anchor === undefined) throw new Error('동반 가능 목 장소가 없다')

    const pets = (await (await fetch('/api/bff/members/me/pets')).json()) as {
      dataBody: { pets: { petId: string }[] }
    }
    const day = (offset: number) => {
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
      return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
    }

    const response = await fetch('/api/bff/plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        areaCode: '39',
        title,
        startDate: day(7),
        endDate: day(8),
        petId: pets.dataBody.pets[0]?.petId,
        items: [
          {
            day: 1,
            sequence: 0,
            itemType: 'PLACE',
            targetId: anchor.placeId,
            title: anchor.title,
            startTime: '10:00:00',
          },
        ],
      }),
    })
    const created = (await response.json()) as { dataBody: { planId: string } }
    return created.dataBody.planId
  }, PLAN_TITLE)
}

test.describe('일정 담기 — 동반 기본 조건 · 한 번 더 확인 · 시각 (#1383)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('빈 URL 은 동반 가능만이다 — 미확인 장소가 목록에 없다', async ({ page }) => {
    await page.goto('/plans')
    const planId = await createPlan(page)

    await page.goto(`/plans/${planId}/days/1/add?view=list`)

    const list = page.locator('#plan-add-place-list')
    await expect(list.getByRole('listitem').first()).toBeVisible()
    await expect(page.getByRole('button', { name: ALLOWED_ONLY }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(list.getByText(UNKNOWN_PLACE, { exact: true })).toHaveCount(0)
  })

  test('미확인 장소는 첫 누름에 이유를 말하고, 두 번째 누름에 시각을 채워 담는다', async ({
    page,
  }) => {
    await page.goto('/plans')
    const planId = await createPlan(page)

    // 목 목록이 거리순 첫 장(20곳)을 넘어 검색어로 좁힌다 — 동반 축은 끈다
    await page.goto(
      `/plans/${planId}/days/1/add?view=list&petAllowanceType=ALL&keyword=${encodeURIComponent(UNKNOWN_PLACE)}`,
    )

    const row = page
      .locator('#plan-add-place-list li')
      .filter({ has: page.getByRole('heading', { name: UNKNOWN_PLACE, exact: true }) })
    await expect(row).toBeVisible()

    let saves = 0
    page.on('request', (request) => {
      if (request.method() === 'PUT' && /\/days\/1\/items$/.test(request.url())) saves += 1
    })

    await row
      .getByRole('button', {
        name: messages.plan.addPlaceLabel.replace('{title}', UNKNOWN_PLACE),
      })
      .click()

    // 첫 누름은 저장하지 않는다 — 이유가 행 안에 선다
    await expect(row.getByRole('status')).toHaveText(messages.plan.addPlaceConfirmUnknown)
    expect(saves).toBe(0)

    const saved = page.waitForRequest(
      (request) => request.method() === 'PUT' && /\/days\/1\/items$/.test(request.url()),
    )
    await row
      .getByRole('button', {
        name: messages.plan.addPlaceConfirmLabel.replace('{title}', UNKNOWN_PLACE),
      })
      .click()

    // 앞 항목 10:00 + 2:30 — 저장 본문과 토스트가 같은 시각을 말한다
    const body = (await saved).postDataJSON() as {
      items: { title: string; startTime?: string }[]
    }
    expect(body.items.find((item) => item.title === UNKNOWN_PLACE)?.startTime).toBe('12:30:00')
    await expect(page.getByText('1일차 12:30에 담았어요', { exact: false })).toBeVisible()
  })

  test('일정 상세의 탭 제목은 일정 이름이다 (#905 R5 를 뒤집었다)', async ({ page }) => {
    await page.goto('/plans')
    const planId = await createPlan(page)

    await page.goto(`/plans/${planId}`)

    await expect(page).toHaveTitle(`${PLAN_TITLE} · 혼디가개`)
  })
})
