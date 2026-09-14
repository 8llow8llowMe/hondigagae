import { expect, type Page, test } from '@playwright/test'

/**
 * **확정을 되돌릴 수 있다** — 이슈 #565.
 *
 * ### 왜 e2e 인가
 *
 * 지키려는 것이 마크업이 아니라 **왕복**이다: 눌러서 `PUT /plans/{id}` 가 나가고, 응답이
 * 캐시에 꽂히고, 배지와 버튼이 그 값으로 다시 그려지는 한 바퀴. node 환경 렌더 테스트는
 * 이벤트도 react-query 도 돌리지 않아(`docs/testing-guide.md` §1) 어느 한 칸도 볼 수 없다.
 *
 * 그리고 이 화면의 **판단 근거 자체가 왕복이다.** 확정에 확인 대화상자를 붙이지 않기로
 * 한 것은 `확정 → 초안` 이 실제로 되기 때문인데, 그 전제가 깨지면(백엔드가 전이 가드를
 * 넣는다거나) 확인 없는 확정이 그 순간 잘못된 설계가 된다. 이 스펙이 그 전제를 지킨다.
 */
test.describe('일정 확정과 되돌리기 (#565)', () => {
  /** 폼을 거치지 않고 초안 일정을 하나 만든다 — 시작 상태를 고정하기 위해서다 */
  async function createDraftPlan(page: Page): Promise<string> {
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

      const response = await fetch('/api/bff/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // 제주 전용이라 화면에는 지역 입력이 없지만 계약에는 필수다 (`PLAN_102`)
          areaCode: '39',
          title: '되돌리기 확인용 일정',
          startDate: day(7),
          endDate: day(9),
          petId: petList.dataBody.pets[0]?.petId,
          items: [],
        }),
      })

      const created = (await response.json()) as { dataBody: { planId: string } }
      return created.dataBody.planId
    })
  }

  test('확정한 일정을 초안으로 되돌린다 — 확인 대화상자 없이 오간다', async ({ page }) => {
    await page.goto('/plans')
    const planId = await createDraftPlan(page)

    await page.goto(`/plans/${planId}`)

    const confirmAction = page.getByRole('button', { name: '일정 확정하기' })
    const revertAction = page.getByRole('button', { name: '초안으로 되돌리기' })

    // ── 초안 ──────────────────────────────────────────────────────────────
    await expect(confirmAction).toBeVisible()
    await expect(revertAction).toHaveCount(0)

    // ── 확정 ──────────────────────────────────────────────────────────────
    await confirmAction.click()

    /*
      **확인 대화상자가 뜨지 않는 것까지 못박는다.** 되돌릴 수 있는 동작에 확인을 붙이면
      되돌릴 수 없다는 거짓말이 된다 — 삭제(`alertdialog`)와 무게가 갈리는 것이 이 화면의
      판단이다. 누군가 "삭제처럼 확인을 받자" 로 되돌리면 여기서 걸린다.
    */
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    await expect(revertAction).toBeVisible()
    await expect(confirmAction).toHaveCount(0)

    // ── 되돌리기 ──────────────────────────────────────────────────────────
    await revertAction.click()

    await expect(confirmAction).toBeVisible()
    await expect(revertAction).toHaveCount(0)
  })
})
