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
  /**
   * 폼을 거치지 않고 초안 일정을 하나 만든다 — 시작 상태를 고정하기 위해서다.
   *
   * **`startOffset` 으로 D-day 를 고른다** (#665). 준비물 승격은 `D-1` 이하에서만 열리는데,
   * 그 갈래를 보려고 **브라우저 시계를 바꾸지 않는다** — `today` 는 서버가 만들어 prop 으로
   * 내려오므로(`app/(main)/plans/[planId]/page.tsx`), 브라우저 시계만 옮기면 서버가 보는
   * 오늘과 갈려 화면이 오히려 틀린 답을 낸다. 일정 쪽 날짜를 옮기는 것이 맞다.
   *
   * **`dayCount` 로 우측 일자 열의 길이를 고른다.** 걸친 트랙의 초과분 분배(D11-3)는 일자
   * 열이 좌측 레일보다 **길 때만** 나타난다 — 3일짜리로는 `grid-template-rows` 를 지워도
   * 간격이 그대로라 처방이 검증되지 않는다(뮤테이션으로 확인).
   */
  async function createDraftPlan(page: Page, startOffset = 7, dayCount = 3): Promise<string> {
    return page.evaluate(
      async ({ offset, dayCount }) => {
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
            startDate: day(offset),
            endDate: day(offset + dayCount - 1),
            petId: petList.dataBody.pets[0]?.petId,
            items: [],
          }),
        })

        const created = (await response.json()) as { dataBody: { planId: string } }
        return created.dataBody.planId
      },
      { offset: startOffset, dayCount },
    )
  }

  test('확정한 일정을 초안으로 되돌린다 — 확인 대화상자 없이 오간다', async ({ page }) => {
    await page.goto('/plans')
    const planId = await createDraftPlan(page)

    await page.goto(`/plans/${planId}`)

    const confirmAction = page.getByRole('button', { name: '일정 확정하기' })
    const manageMenu = page.getByRole('button', { name: '일정 관리' })
    const revertItem = page.getByRole('menuitem', { name: '초안으로 되돌리기' })
    const shareItem = page.getByRole('menuitem', { name: '공유 링크' })

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

    /*
      **초안에는 공유도 없다** (#628). 서버가 초안 공유를 `PLAN_022` 로 막으므로 항목을
      보여 주고 눌러서 배우게 하지 않는다 — 항목 자체가 없다. 누군가 "일단 띄우고 오류로
      안내하자" 로 되돌리면 여기서 걸린다.
    */
    await expect(shareItem).toHaveCount(0)
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

      **`공유 링크` 는 역방향 위다** (#628) — 아래로 갈수록 무게가 는다. 확정·완료에만
      있으므로 위 초안 갈래에서는 이 배열에 없었다.
    */
    await expect(page.getByRole('menuitem')).toHaveText([
      '이름·기간·예산 수정',
      '공유 링크',
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
  /**
   * 화면에 실제로 읽히는 순서. **`innerText` 는 보이는 것만 준다** — 데스크톱 전용
   * 목차(`hidden lg:block`)의 `1일차` 가 390 에서 섞여 들지 않는다.
   */
  async function readingOrder(page: Page): Promise<string> {
    await expect(page.getByRole('heading', { name: '1일차' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '여행 준비물' })).toBeVisible()
    await expect(page.getByRole('link', { name: /가는 곳 주변 병원·약국/ })).toBeVisible()

    return page.locator('body').innerText()
  }

  test('모바일에서 일자가 준비물보다 먼저다 — D-7 (기본)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/plans')
    const planId = await createDraftPlan(page)

    await page.goto(`/plans/${planId}`)

    const text = await readingOrder(page)

    expect(text.indexOf('1일차')).toBeLessThan(text.indexOf('여행 준비물'))

    /* 아래 레일 안의 순서도 약속이다 — 준비물 → (후기) → 배너 */
    expect(text.indexOf('여행 준비물')).toBeLessThan(text.indexOf('가는 곳 주변 병원·약국'))
  })

  /**
   * **출발이 가까우면 준비물이 일자 위다** (#665 · 진단 PL-3 · 명세 D11-9).
   *
   * #653 이 준비물을 일자 뒤로 내린 근거가 _"준비물은 출발 전날 과업"_ 이었는데, **바로 그
   * 출발 전날에는 뒤집힌다.** 승격 판정 자체(경계 · 자정)는 `packing-promotion.test.ts` 가
   * 잠그고, 여기가 보는 것은 **그 `boolean` 이 실제 DOM 순서로 나타나는가** 다 —
   * `PlanDetailSection` 은 React Query 훅을 들어 `renderToStaticMarkup` 으로 볼 수 없다.
   */
  test('모바일에서 준비물이 일자보다 먼저다 — D-1 (승격)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/plans')
    const planId = await createDraftPlan(page, 1)

    await page.goto(`/plans/${planId}`)

    const text = await readingOrder(page)

    expect(text.indexOf('여행 준비물')).toBeLessThan(text.indexOf('1일차'))

    /* **승격이 배너까지 끌어올리지 않는다** — 배너는 상시 진입점이라 D-day 와 무관하다 */
    expect(text.indexOf('1일차')).toBeLessThan(text.indexOf('가는 곳 주변 병원·약국'))
  })

  /**
   * **데스크톱 좌 레일의 보이는 순서는 두 갈래가 같다** (명세 D11-9-3 · D11-8).
   *
   * 준비물이 `row 1` 끝에 붙든 `row 2` 머리에 오든 두 행이 세로로 이어 붙어 있어 좌측
   * 열에서 읽는 자리가 같다 — **CSS 없이 DOM 이동만으로** 모바일 순서와 데스크톱 순서를
   * 동시에 만족하는 근거가 이것이고, 그 근거는 브라우저가 계산해야 보인다.
   *
   * 간격도 함께 잰다. `.rail-layout-split` 의 `grid-template-rows: max-content minmax(0, 1fr)`
   * 을 `auto` 로 되돌리면 두 행에 걸친 일자 열의 초과분이 `row 1` 에 얹혀 위·아래 레일
   * 사이가 벌어진다(#653 실측 325~523px) — 승격으로 `row 1` 이 준비물 높이만큼 길어져도
   * 그 처방이 그대로 사는지 보는 자리다.
   */
  for (const branch of [
    { name: '비승격 (D-7)', startOffset: 7 },
    { name: '승격 (D-1)', startOffset: 1 },
  ]) {
    test(`데스크톱 좌 레일의 순서와 간격은 그대로다 — ${branch.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto('/plans')
      /*
        **일자 열이 좌측 레일보다 길어야 한다** — 그래야 `grid-row: 1 / span 2` 인 일자
        열의 초과분이 어느 행으로 가는지가 간격에 나타난다. 10일은 재생성 차단선(11일)
        아래이고, 초과분 분배가 확실히 일어날 만큼 길다.
      */
      const planId = await createDraftPlan(page, branch.startOffset, 10)

      await page.goto(`/plans/${planId}`)

      const title = page.getByRole('heading', { level: 1 })
      const packing = page.getByRole('heading', { name: '여행 준비물' })
      const banner = page.getByRole('link', { name: /가는 곳 주변 병원·약국/ })
      const day = page.getByRole('heading', { name: '1일차' }).first()
      for (const target of [title, packing, banner, day]) {
        await expect(target).toBeVisible()
      }

      const box = async (target: typeof title) => {
        const rect = await target.boundingBox()
        if (rect === null) throw new Error('레이아웃을 재지 못했다')
        return rect
      }

      // 좌측 열의 보이는 순서 — 개요 → 준비물 → 배너
      expect((await box(title)).y).toBeLessThan((await box(packing)).y)
      expect((await box(packing)).y).toBeLessThan((await box(banner)).y)

      // 준비물은 좌측 레일이다 — 일자 열로 건너가지 않는다
      expect((await box(packing)).x).toBeLessThan((await box(day)).x)

      /*
        위·아래 레일 사이 24. **스택의 상자가 아니라 카드의 상자로 잰다** — 위 스택의
        `md:p-6`(아래 24)과 아래 스택의 `md:pt-0` 이 만드는 값이라 눈에 보이는 간격이다.
      */
      await expect
        .poll(() =>
          page.evaluate(() => {
            const cardsOf = (selector: string) => {
              const stack = document.querySelector(selector)
              if (stack === null) return []
              return [...stack.children]
                .map((child) => child.getBoundingClientRect())
                .filter((rect) => rect.height > 0)
            }

            const top = cardsOf('.rail-split-top')
            const bottom = cardsOf('.rail-split-bottom')
            if (top.length === 0 || bottom.length === 0) return Number.NaN

            return Math.round(
              Math.min(...bottom.map((rect) => rect.top)) -
                Math.max(...top.map((rect) => rect.bottom)),
            )
          }),
        )
        .toBe(24)
    })
  }
})
