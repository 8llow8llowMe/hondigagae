import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * **담기 목록 보기가 그날 기준점에서 가까운 순이다** — 이슈 #1217 (BE #1202).
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 한 바퀴다: 서버가 상세에서 기준점을 내 거리순 첫 장을 프리페치하고, 클라이언트가
 * **같은 key** 로 그것을 받아 그리고, 행마다 거리가 붙는다. 기준점 · 키 · 쿼리는 각자 단위 테스트가
 * 있지만(`add-place-focus` · `queries` · `place-filters`), 서버와 클라이언트가 같은 점을 내는지는
 * 렌더해 봐야 안다 — 어긋나면 첫 화면에서 목록을 한 번 더 받고 순서가 뒤집힌다.
 *
 * ### 무엇으로 판정하나
 *
 * 그날 유일한 항목을 장소 A 로 둔다. 기준점은 A 의 좌표이므로 **A 자신이 0m 로 첫 행**이어야 하고,
 * 그 아래 거리는 줄지 않아야 한다. `placeId` 순(예전 동작)이면 A 가 첫 행일 이유가 없다.
 */
test.describe('담기 목록 보기의 거리순 (#1217)', () => {
  /** 서귀포 쪽 장소 하나를 고르고, 그것만 1일차에 담은 일정을 만든다 */
  async function createPlanAround(page: Page): Promise<{ planId: string; title: string }> {
    return page.evaluate(async () => {
      const list = (await (await fetch('/api/bff/places?areaCode=39&size=50')).json()) as {
        dataBody: { contents: { placeId: string; title: string; lat: number | null }[] }
      }
      // 목록 첫 장(placeId 순)의 맨 앞이 아닌 곳이어야 "순서가 바뀌었다" 가 판정된다
      const anchor = list.dataBody.contents.find(
        (place, index) => index > 0 && place.lat !== null && place.lat < 33.35,
      )
      if (anchor === undefined) throw new Error('기준으로 쓸 서귀포 쪽 목 장소가 없다')

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
          title: '거리순 확인용 일정',
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
            },
          ],
        }),
      })
      const created = (await response.json()) as { dataBody: { planId: string } }
      return { planId: created.dataBody.planId, title: anchor.title }
    })
  }

  test('그날 장소가 0m 로 첫 행이고, 아래로 갈수록 멀어진다', async ({ page }) => {
    await page.goto('/plans')
    const { planId, title } = await createPlanAround(page)

    await page.goto(`/plans/${planId}/days/1/add?view=list`)

    // 순서의 이유를 목록 위 한 줄이 말한다
    await expect(page.getByText(messages.plan.addPlaceNearbyCaption)).toBeVisible()

    const rows = page.locator('#plan-add-place-list li')
    await expect(rows.first()).toContainText(title)
    await expect(rows.first()).toContainText('0m')

    // 메타 줄 끝의 거리를 m 로 읽어 줄지 않는지 본다 — 서버 정렬 키가 곧 그 숫자다
    const metas = await rows.locator('p.tabular-nums').allTextContents()
    const meters = metas.map((meta) => {
      const match = /([\d.]+)(km|m)$/.exec(meta.trim())
      if (match === null) throw new Error(`거리 없는 행: ${meta}`)
      return Number(match[1]) * (match[2] === 'km' ? 1000 : 1)
    })
    expect(meters.length).toBeGreaterThan(1)
    expect(meters).toEqual([...meters].sort((left, right) => left - right))
  })
})
