import { expect, type Page, test } from '@playwright/test'

/**
 * **AI 초안의 빈 날과 빈 초안 실패** — 이슈 #1270 (백엔드 #1268 · PR #1273).
 *
 * ### 왜 e2e 인가
 *
 * 렌더 분기는 `ai-plan-draft-preview.test.ts` 가 마크업으로 단언한다. 여기서 지키려는 것은
 * **작업 조회 응답이 그 분기까지 닿는 길**이다 — 폴링 → 상태 판정 → 미리보기 / 실패 화면의
 * `hint`. 실패 단서를 고르는 `failureHint` 는 훅이 걸린 클라이언트 컴포넌트 안에 있어 node
 * 렌더 테스트가 볼 수 없다.
 *
 * ### 재현 조건을 어떻게 만드나
 *
 * mock 은 늘 모든 날을 채운 초안을 낸다. **응답만 `page.route` 로 덮는다** — mock 이 낸 실제
 * 작업 응답을 받아(`route.fetch`) 완료에 닿았을 때 그 몸통만 바꾼다. 봉투 · 조건 · 단계는
 * mock 의 것을 그대로 두므로 모양을 손으로 지어내지 않는다.
 *
 * SSE 는 끊는다(`abort`) — 화면이 폴링으로 넘어가야 덮은 조회 응답을 본다 (명세 S3:
 * 끊기면 폴링이 받는다).
 */

type JobBody = {
  status: { code: string; name: string; description: string }
  planDraft: { days: { day: number; items: unknown[] }[] } | null
  errorCode: string | null
  errorMessage: string | null
}

/** 폼을 거치지 않고 3일짜리 작업을 낸다 (`ai-plan-conditions.spec.ts` 와 같은 방법) */
async function submitThreeDays(page: Page): Promise<string> {
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

/** 완료에 닿은 조회 응답의 몸통을 `patch` 로 바꾼다. SSE 는 끊어 폴링으로 보낸다 */
async function overrideCompletedJob(
  page: Page,
  jobId: string,
  patch: (body: JobBody) => JobBody,
): Promise<void> {
  await page.route(`**/api/bff/ai-plans/jobs/${jobId}/stream**`, (route) => route.abort())
  await page.route(`**/api/bff/ai-plans/jobs/${jobId}`, async (route) => {
    const response = await route.fetch()
    const envelope = (await response.json()) as { dataBody: JobBody }

    if (envelope.dataBody.status.code === 'COMPLETED') {
      envelope.dataBody = patch(envelope.dataBody)
    }

    await route.fulfill({ response, json: envelope })
  })
}

test.describe('AI 초안의 빈 날 (#1270)', () => {
  test('일부만 빈 초안은 만든 날을 세고 빈 날 카드에 안내를 단다', async ({ page }) => {
    await page.goto('/plans')
    const jobId = await submitThreeDays(page)

    // 2일차는 항목이 없고 3일차는 숙소뿐이다 — 둘 다 빈 날이다 (백엔드 hasVisitItem)
    await overrideCompletedJob(page, jobId, (body) => ({
      ...body,
      planDraft:
        body.planDraft === null
          ? null
          : {
              ...body.planDraft,
              days: body.planDraft.days.map((dayItem) => {
                if (dayItem.day === 2) return { ...dayItem, items: [] }
                if (dayItem.day === 3) {
                  return {
                    ...dayItem,
                    items: [
                      { itemType: 'LODGING', placeId: null, title: '협재 펫 스테이', note: null },
                    ],
                  }
                }
                return dayItem
              }),
            },
    }))

    await page.goto(`/ai-plans/jobs/${jobId}`)

    await expect(page.getByText('3일 중 1일만 만들었어요.')).toBeVisible({ timeout: 20_000 })

    const emptyDay = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: '2일차' }),
    })
    await expect(emptyDay.getByText('이 날은 AI가 채우지 못했어요')).toBeVisible()

    // 숙소만 있는 날 — 안내를 달고 숙소 행은 남긴다(담기가 그대로 싣는다)
    const lodgingDay = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: '3일차' }),
    })
    await expect(lodgingDay.getByText('이 날은 AI가 채우지 못했어요')).toBeVisible()
    await expect(lodgingDay.getByText('협재 펫 스테이')).toBeVisible()

    const filledDay = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: '1일차' }),
    })
    await expect(filledDay.getByText('이 날은 AI가 채우지 못했어요')).toHaveCount(0)

    await expect(
      page.getByText('방문 전 운영 시간과 반려견 동반 조건을 한 번 더 확인해 주세요.'),
    ).toBeVisible()

    // 담기는 막히지 않는다 — 빈 날은 담은 뒤 일정 화면에서 채운다
    await expect(page.getByRole('button', { name: '내 일정에 담기' })).toBeEnabled()
  })

  test('빈 초안 실패(AIPLAN_022)에 같은 조건으로 다시 시도하라는 단서를 단다', async ({ page }) => {
    await page.goto('/plans')
    const jobId = await submitThreeDays(page)

    await overrideCompletedJob(page, jobId, (body) => ({
      ...body,
      status: { code: 'FAILED', name: '실패', description: 'AI 일정 생성에 실패했습니다.' },
      planDraft: null,
      errorCode: 'AIPLAN_022',
      // 백엔드 `AiPlanErrorCode.LLM_EMPTY_PLAN` 문구 그대로
      errorMessage:
        'AI가 이번에는 일정을 채우지 못했습니다. 조건은 그대로 두고 다시 시도해 주세요.',
    }))

    await page.goto(`/ai-plans/jobs/${jobId}`)

    await expect(page.getByText('일정을 만들지 못했어요')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('AI가 이번에는 일정을 채우지 못했습니다.')).toBeVisible()
    await expect(page.getByText('같은 조건으로 다시 시도하면 대개 만들어져요.')).toBeVisible()
  })
})
