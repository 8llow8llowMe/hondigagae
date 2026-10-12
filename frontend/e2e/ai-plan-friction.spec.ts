import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * AI 일정 조건 · 결과 화면의 마찰 — 이슈 #1381 (`docs/ux-review-2026-10-11.md` §3-3 · §3-8).
 *
 * ### 왜 e2e 인가
 *
 * - 반려견 미리 선택은 **헤더 스위처의 저장값(localStorage)** 을 폼이 마운트 뒤에 읽는지에 달렸다.
 *   단위 테스트는 판정(`defaultAiPlanPetIds`)만 잰다.
 * - 하단 고정 담기는 `sticky` · 탭바 위 오프셋(`.bottom-tabbar`) · `form` 속성 제출이 실제 레이아웃과
 *   브라우저에서만 맞물린다.
 */
const SELECTED_PET_KEY = 'hdg_selected_pet'

async function petList(page: Page): Promise<{ petId: string; name: string }[]> {
  return page.evaluate(async () => {
    const body = (await (await fetch('/api/bff/members/me/pets')).json()) as {
      dataBody: { pets: { petId: string; name: string }[] }
    }
    return body.dataBody.pets
  })
}

/** 폼을 거치지 않고 2일짜리 작업을 낸다 (`ai-plan-empty-days.spec.ts` 와 같은 방법) */
async function submitTwoDays(page: Page, petId: string, requestNote = ''): Promise<string> {
  return page.evaluate(
    async ({ id, note }) => {
      const day = (offset: number) => {
        const now = new Date()
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
        return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
      }

      const response = await fetch('/api/bff/ai-plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          areaCode: '39',
          startDate: day(30),
          endDate: day(31),
          petIds: [id],
          ...(note === '' ? {} : { requestNote: note }),
        }),
      })
      const submitted = (await response.json()) as { dataBody: { jobId: string } }
      return submitted.dataBody.jobId
    },
    { id: petId, note: requestNote },
  )
}

test.describe('AI 일정 마찰 줄이기 (#1381)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('반려견이 여럿이면 헤더에서 고른 아이를 미리 체크한다', async ({ page }) => {
    await page.goto('/plans')
    const pets = await petList(page)
    expect(pets.length).toBeGreaterThan(1)

    const chosen = pets[1]
    if (chosen === undefined) throw new Error('두 번째 목 반려견이 없다')
    // 헤더 스위처의 선택값이다 — 토큰이 아니다 (`selected-pet-store.ts`, auth-guide 는 토큰만 금지)
    await page.evaluate(
      // eslint-disable-next-line no-restricted-globals -- 위 주석: 반려견 선택값이지 토큰이 아니다
      ({ key, id }) => localStorage.setItem(key, id),
      { key: SELECTED_PET_KEY, id: chosen.petId },
    )

    // 서버가 다른 아이를 체크한 마크업을 내면 React 가 하이드레이션 경고를 낸다 (리뷰 지적)
    const hydrationErrors: string[] = []
    page.on('console', (message) => {
      if (/hydrat/i.test(message.text())) hydrationErrors.push(message.text())
    })

    await page.goto('/ai-plans/new')

    const chosenBox = page.getByRole('checkbox', { name: chosen.name, exact: false })
    await expect(chosenBox).toBeChecked()
    // 선택 행 강조(테두리 · 배경)도 체크와 같은 행이다 — 서버 값에 남지 않는다
    await expect(page.locator('label').filter({ has: chosenBox })).toHaveClass(/bg-row-selected/)
    expect(hydrationErrors).toEqual([])
    for (const other of pets.filter((pet) => pet.petId !== chosen.petId)) {
      await expect(page.getByRole('checkbox', { name: other.name, exact: false })).not.toBeChecked()
    }
  })

  test('메모가 서귀포를 말하면 지역 칩을 제안하고, 고르면 서귀포시가 켜진다', async ({ page }) => {
    await page.goto('/ai-plans/new')

    await page.getByLabel(messages.aiPlan.fieldNote).fill('서귀포 위주로 이동은 짧게')

    const suggest = page.getByText(messages.aiPlan.regionSuggest.replace('{region}', '서귀포시'))
    await expect(suggest).toBeVisible()

    await page
      .getByRole('button', {
        name: messages.aiPlan.regionSuggestApply.replace('{region}', '서귀포시'),
      })
      .click()

    await expect(suggest).toHaveCount(0)
    // 누른 버튼이 사라져도 포커스가 BODY 로 떨어지지 않고 메모로 돌아간다
    await expect(page.getByLabel(messages.aiPlan.fieldNote)).toBeFocused()
    await expect(page.getByRole('radio', { name: '서귀포시' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('괜찮아요 로 물리면 제안이 사라지고 지역은 그대로다', async ({ page }) => {
    await page.goto('/ai-plans/new')

    await page.getByLabel(messages.aiPlan.fieldNote).fill('애월 카페 위주')
    await page.getByRole('button', { name: messages.aiPlan.regionSuggestDismiss }).click()

    await expect(
      page.getByText(messages.aiPlan.regionSuggest.replace('{region}', '제주시')),
    ).toHaveCount(0)
  })

  test('모바일 결과 화면은 담기 버튼이 탭바 위에 고정돼 있고, 누르면 담긴다', async ({ page }) => {
    await page.goto('/plans')
    const [first] = await petList(page)
    if (first === undefined) throw new Error('목 반려견이 없다')
    const jobId = await submitTwoDays(page, first.petId)

    await page.goto(`/ai-plans/jobs/${jobId}`)

    // 하단 바의 버튼 하나만 보인다 — 패널의 버튼은 768 미만에서 숨는다
    const submit = page.getByRole('button', { name: messages.aiPlan.commitSubmit })
    await expect(submit).toHaveCount(1, { timeout: 20_000 })
    await expect(submit).toBeVisible()

    // 스크롤하지 않아도 화면 안, 탭바(64) 위에 있다
    const box = await submit.boundingBox()
    if (box === null) throw new Error('담기 버튼의 상자를 못 쟀다')
    expect(box.y + box.height).toBeLessThanOrEqual(812 - 64)

    await expect(page).toHaveTitle(`${messages.aiPlan.jobTitle} · 혼디가개`)

    await submit.click()
    await expect(page).toHaveURL(/\/plans\/\d+$/, { timeout: 20_000 })
  })

  test('하단 바로 담다 실패하면 포커스와 화면이 담기 패널의 실패 이유로 간다', async ({ page }) => {
    await page.goto('/plans')
    const [first] = await petList(page)
    if (first === undefined) throw new Error('목 반려견이 없다')
    // mock: 메모에 '사라진' 이 있으면 첫 항목이 없는 장소라 담기가 PLAN_004 로 막힌다
    const jobId = await submitTwoDays(page, first.petId, '사라진 장소 확인')

    await page.goto(`/ai-plans/jobs/${jobId}`)
    const submit = page.getByRole('button', { name: messages.aiPlan.commitSubmit })
    await expect(submit).toBeVisible({ timeout: 20_000 })

    await submit.click()

    const reason = page.getByText(messages.aiPlan.commitDelistedTitle)
    await expect(reason).toBeVisible()
    await expect(reason).toBeInViewport()
    expect(
      await page.evaluate(
        (id) => document.getElementById(id)?.contains(document.activeElement) ?? false,
        'ai-plan-commit',
      ),
    ).toBe(true)
  })
})
