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
 *
 * ### 메뉴 안은 여기서만 볼 수 있다 (#653)
 *
 * 역방향 상태 변경(`초안으로 되돌리기`)과 일자의 `다시 만들기` 가 `⋯` 메뉴로 내려갔는데,
 * 닫힌 `Menu` 는 `null` 을 렌더한다(`src/components/menu.tsx`). 즉 **정적 마크업 테스트로는
 * 항목도 링크도 볼 수 없다** — 열어서 확인할 수 있는 곳이 여기뿐이다.
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
    const manageMenu = page.getByRole('button', { name: '일정 관리' })
    const revertItem = page.getByRole('menuitem', { name: '초안으로 되돌리기' })

    /*
      **정방향은 버튼, 역방향은 메뉴다** (#653 · 진단 PL-2 · 명세 D11-2). 390 실측에서
      완료 일정의 유일한 전폭 버튼이 `확정으로 되돌리기` 였다 — 여행의 진행 방향을 거스르는
      것이 화면에서 가장 강한 자리를 차지할 이유가 없다. 이 스펙이 그 갈래를 못박는다.
    */
    async function openManageMenu() {
      await manageMenu.click()
      await expect(page.getByRole('menu')).toBeVisible()
    }

    // ── 초안 ──────────────────────────────────────────────────────────────
    await expect(confirmAction).toBeVisible()

    // 초안에는 되돌아갈 앞 상태가 없다 — 메뉴를 열어도 항목이 없다
    await openManageMenu()
    await expect(revertItem).toHaveCount(0)
    await page.keyboard.press('Escape')

    // ── 확정 ──────────────────────────────────────────────────────────────
    await confirmAction.click()

    /*
      **확인 대화상자가 뜨지 않는 것까지 못박는다.** 되돌릴 수 있는 동작에 확인을 붙이면
      되돌릴 수 없다는 거짓말이 된다 — 삭제(`alertdialog`)와 무게가 갈리는 것이 이 화면의
      판단이다. 누군가 "삭제처럼 확인을 받자" 로 되돌리면 여기서 걸린다.
    */
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    // 확정의 정방향은 `여행 완료하기` 다. 되돌리기는 화면에 버튼으로 서지 않는다
    await expect(page.getByRole('button', { name: '여행 완료하기' })).toBeVisible()
    await expect(confirmAction).toHaveCount(0)
    await expect(page.getByRole('button', { name: '초안으로 되돌리기' })).toHaveCount(0)

    // ── 되돌리기 — 메뉴 안에서 ────────────────────────────────────────────
    await openManageMenu()
    await expect(revertItem).toBeVisible()

    /*
      **파괴적 항목은 마지막이고 역방향은 그 위다** (명세 D11-2). 역방향은 되돌릴 수
      있으므로 `danger-900` + 구분선 자리(삭제)와 섞이면 안 된다.
    */
    await expect(page.getByRole('menuitem')).toHaveText([
      '이름·기간·예산 수정',
      '초안으로 되돌리기',
      '일정 삭제',
    ])

    await revertItem.click()

    await expect(confirmAction).toBeVisible()
  })

  /*
    **일자 오버플로 안의 `다시 만들기`** (#653 · 진단 PL-4 · 명세 D11-4).

    `href` 로 넣은 것이 핵심이라 링크로 남아 있는지까지 본다 — `onSelect` + `router.push` 로
    흉내내면 새 탭·가운데클릭·주소 복사가 죽는다 (`menu.tsx` 주석).
  */
  test('일자 오버플로에 다시 만들기가 링크로 있다', async ({ page }) => {
    await page.goto('/plans')
    const planId = await createDraftPlan(page)

    await page.goto(`/plans/${planId}`)

    // 액션은 판정·항목을 읽은 뒤에 온다 — 제목 줄에 남는 것은 `⋯` 하나다
    // (`장소 추가` 는 모달이 아니라 라우트라 `ButtonLink` = `<a>` 다)
    await expect(page.getByRole('link', { name: '장소 추가' }).first()).toBeVisible()

    await page.getByRole('button', { name: '1일차 관리' }).click()

    const regenerate = page.getByRole('menuitem', { name: '다시 만들기' })
    await expect(regenerate).toBeVisible()
    await expect(regenerate).toHaveAttribute('href', `/plans/${planId}/days/1/regenerate`)
  })

  /*
    **`.rail-layout-split` 의 층 규약이다** (#653 · 명세 D11-3, `app/globals.css`).

    이 클래스가 약속하는 것은 *"레일이 본문 앞뒤 둘로 갈리고, `lg` 미만에서는 DOM 순서대로
    쌓인다"* 이고 **그 약속은 브라우저가 계산해야 보인다** — 클래스가 붙었는지로는 검증되지
    않는다 (testing-guide.md §12 의 "공용 컴포넌트의 반응형 계약" 갈래).
    `PlanDetailSection` 은 React Query 훅을 들어 `renderToStaticMarkup` 으로 볼 수 없고,
    이 클래스의 사용처는 지금 이 화면 하나라 **모든 사용처를 보는 것**이기도 하다.

    **픽셀 임계값(`< 844` 같은 것)은 재지 않는다.** 그것이 §12 가 막는 "화면 고유의 배치" 다
    — 개요 카드가 한 줄만 늘어도 깨진다. 순서만 본다.
  */
  test('모바일에서 일자가 준비물보다 먼저다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/plans')
    const planId = await createDraftPlan(page)

    await page.goto(`/plans/${planId}`)

    const day = page.getByRole('heading', { name: '1일차' })
    const packing = page.getByRole('heading', { name: '여행 준비물' })
    await expect(day).toBeVisible()
    await expect(packing).toBeVisible()

    const dayTop = (await day.boundingBox())?.y ?? 0
    const packingTop = (await packing.boundingBox())?.y ?? 0

    expect(dayTop).toBeLessThan(packingTop)

    /* 아래 레일 안의 순서도 약속이다 — 준비물 → (후기) → 배너 */
    const bannerTop =
      (await page.getByRole('link', { name: /가는 곳 주변 병원·약국/ }).boundingBox())?.y ?? 0

    expect(packingTop).toBeLessThan(bannerTop)
  })
})
