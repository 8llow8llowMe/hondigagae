import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { trackAppRouterMount, waitForAppRouterMounted } from './helpers/app-router'
import { hasListView, mapFailedToList } from './helpers/map-fallback'

/**
 * **반려견을 바꾸면 체구 필터 URL 이 새 반려견 값으로 맞춰진다** — 장소-반려견칩-세부명세 D7-5 (#1301).
 *
 * 체구 필터(`몽실이(소형견)이 들어갈 수 있는 곳만`)는 켜질 때 그 반려견의 크기 · 체중을 URL 에 적는다. 예전에는
 * 반려견을 바꿔도 URL 이 옛 값이라 결과가 그대로였다 — 필터 안내(`반려견을 바꾸면 결과도 바뀌어요.`)가 거짓이었다.
 *
 * ### 지도 보기 칩은 여기서 못 본다
 *
 * e2e 에는 카카오 SDK 가 없어 지도 보기가 목록 보기로 옮겨진다(#1289 · `helpers/map-fallback.ts`) — 칩도 함께
 * 사라진다. 칩의 모양 · 메뉴는 vitest(`pet-switcher*.test.ts`)가 맡고, 이 스펙은 **목록 보기에서 띠 헤더 스위처로**
 * 같은 동기화(`PlaceFilterPetSync`)를 잰다. 바꾸는 곳이 칩이든 헤더든 맞추는 곳은 하나다.
 *
 * 목 계정 `demo@` = 몽실이(SMALL · 3.5kg) · 초코(LARGE · 체중 없음) (`src/lib/api/mock/store.ts`).
 */

const LIST = '/places?view=list'
/** 목 저장소의 초코 — 저장된 반려견을 첫 반려견과 다르게 두는 데 쓴다 */
const CHOCO_PET_ID = '123456789012000002'
const SELECTED_PET_KEY = 'hdg_selected_pet'

const switcherName = (name: string) => `${messages.pet.switcherNamePrefix} ${name}`

/** 데스크톱 레일의 체구 필터 — 이름에 지금 반려견의 이름 · 크기가 든다 */
function sizeFilter(page: Page, nameWithSize: string) {
  return page
    .getByRole('complementary', { name: messages.place.filterTitle })
    .getByRole('checkbox', { name: new RegExp(`^${escape(nameWithSize)}이 들어갈 수 있는 곳만`) })
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function openList(page: Page, path: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 })
  await trackAppRouterMount(page)
  await page.goto(path)
  await waitForAppRouterMounted(page)
}

async function switchTo(page: Page, from: string, to: string): Promise<void> {
  const banner = page.getByRole('banner')
  await banner.getByRole('button', { name: switcherName(from) }).click()
  await banner.getByRole('menuitemradio', { name: to }).click()
  await expect(banner.getByRole('button', { name: switcherName(to) })).toBeVisible()
}

test.describe('체구 필터 URL 맞춤 (#1301)', () => {
  test('체구 필터를 켠 채 반려견을 바꾸면 URL 의 크기 · 체중이 새 반려견 값이 된다 — replace', async ({
    page,
  }) => {
    await openList(page, LIST)

    await sizeFilter(page, '몽실이(소형견)').click()
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get('petSizeType') === 'SMALL' &&
        url.searchParams.get('petWeightKg') === '4',
    )
    const historyBefore = await page.evaluate(() => history.length)

    await switchTo(page, '몽실이', '초코')

    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get('petSizeType') === 'LARGE' &&
        !url.searchParams.has('petWeightKg') &&
        url.searchParams.get('view') === 'list',
    )
    await expect(sizeFilter(page, '초코(대형견)')).toBeChecked()
    expect(await page.evaluate(() => history.length)).toBe(historyBefore)
  })

  test('체구 필터가 꺼져 있으면 반려견을 바꿔도 URL 이 그대로다', async ({ page }) => {
    await openList(page, LIST)
    const before = page.url()

    await switchTo(page, '몽실이', '초코')

    await expect(sizeFilter(page, '초코(대형견)')).not.toBeChecked()
    expect(page.url()).toBe(before)
  })

  test('체구 필터를 켠 링크로 처음 들어오면 저장된 반려견이 달라도 URL 을 고치지 않는다', async ({
    page,
  }) => {
    // 저장된 반려견 = 초코 (첫 반려견은 몽실이). 복원은 "바꿈" 이 아니다
    await page.addInitScript(
      // eslint-disable-next-line no-restricted-globals -- 토큰이 아니라 고른 반려견 id(UI 편의값, `selected-pet-store.ts`)다
      ([key, petId]) => localStorage.setItem(key, petId),
      [SELECTED_PET_KEY, CHOCO_PET_ID] as const,
    )
    await openList(page, `${LIST}&petSizeType=SMALL&petWeightKg=4`)

    // 복원이 끝나 헤더가 초코를 보인 뒤에도
    await expect(
      page.getByRole('banner').getByRole('button', { name: switcherName('초코') }),
    ).toBeVisible()
    await expect(sizeFilter(page, '초코(대형견)')).toBeChecked()
    // 동기화 effect 가 돌 틈을 준다 — 고쳤다면 이 사이에 replace 가 나간다
    await page.waitForTimeout(500)

    const url = new URL(page.url())
    expect(url.searchParams.get('petSizeType')).toBe('SMALL')
    expect(url.searchParams.get('petWeightKg')).toBe('4')
  })

  test('지도 보기가 목록 보기로 옮겨지면 반려견 칩이 없다 — 띠 헤더 스위처만 선다 (D8-1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/places')
    await mapFailedToList(page, hasListView)

    await expect(
      page.getByRole('banner').getByRole('button', { name: switcherName('몽실이') }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('main')
        .getByRole('button', { name: new RegExp(`^${messages.pet.switcherNamePrefix}`) }),
    ).toHaveCount(0)
  })
})
